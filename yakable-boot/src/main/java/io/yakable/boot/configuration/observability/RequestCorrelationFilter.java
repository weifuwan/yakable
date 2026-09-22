package io.yakable.boot.configuration.observability;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * 为每个 HTTP 请求建立日志关联 ID。
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestCorrelationFilter extends OncePerRequestFilter {

    public static final String HEADER_NAME = "X-Request-Id";
    public static final String MDC_KEY = "traceId";

    private static final int MAX_REQUEST_ID_LENGTH = 64;
    private static final Pattern REQUEST_ID_PATTERN = Pattern.compile("[A-Za-z0-9._:-]+");

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        String requestId = resolveRequestId(request.getHeader(HEADER_NAME));
        response.setHeader(HEADER_NAME, requestId);

        try (MDC.MDCCloseable ignored = MDC.putCloseable(MDC_KEY, requestId)) {
            filterChain.doFilter(request, response);
        }
    }

    private static String resolveRequestId(String candidate) {
        if (candidate == null) {
            return UUID.randomUUID().toString();
        }
        String value = candidate.strip();
        if (value.isEmpty()
                || value.length() > MAX_REQUEST_ID_LENGTH
                || !REQUEST_ID_PATTERN.matcher(value).matches()) {
            return UUID.randomUUID().toString();
        }
        return value;
    }
}
