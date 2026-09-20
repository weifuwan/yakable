package io.yakable.boot.configuration.exception;

import io.yakable.common.ErrorCode;
import io.yakable.common.enums.session.SessionErrorCode;
import io.yakable.common.exception.BusinessException;
import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.server.ResponseStatusException;

/**
 * 所有 Controller 的统一异常出口。
 */
@GlobalException
public class GlobalExceptionHandler {

    private static final System.Logger log = System.getLogger(GlobalExceptionHandler.class.getName());
    private static final int INVALID_REQUEST_CODE = 40000;
    private static final int INTERNAL_ERROR_CODE = 50000;
    private static final String INVALID_REQUEST_MESSAGE = "Invalid request";
    private static final String INTERNAL_ERROR_MESSAGE = "Internal server error";

    @ExceptionHandler(BusinessException.class)
    ProblemDetail handleBusinessException(BusinessException exception) {
        ErrorCode errorCode = exception.getErrorCode();
        if (errorCode == null) {
            log.log(System.Logger.Level.WARNING, "Business exception without ErrorCode", exception);
            return problem(HttpStatus.BAD_REQUEST, INVALID_REQUEST_CODE, INVALID_REQUEST_MESSAGE);
        }
        return problem(businessStatus(errorCode), errorCode.getCode(), errorCode.getMessage());
    }

    @ExceptionHandler({
            MethodArgumentNotValidException.class,
            ConstraintViolationException.class,
            HttpMessageNotReadableException.class,
            IllegalArgumentException.class
    })
    ProblemDetail handleInvalidRequest(Exception exception) {
        log.log(System.Logger.Level.DEBUG, "Invalid request", exception);
        return problem(HttpStatus.BAD_REQUEST, INVALID_REQUEST_CODE, INVALID_REQUEST_MESSAGE);
    }

    @ExceptionHandler(ResponseStatusException.class)
    ProblemDetail handleResponseStatus(ResponseStatusException exception) {
        HttpStatus status = HttpStatus.resolve(exception.getStatusCode().value());
        HttpStatus resolved = status == null ? HttpStatus.BAD_REQUEST : status;
        String message = resolved == HttpStatus.NOT_FOUND ? "Resource not found" : "Request failed";
        return problem(resolved, resolved.value() * 100, message);
    }

    @ExceptionHandler(Exception.class)
    ProblemDetail handleUnexpectedException(Exception exception) {
        log.log(System.Logger.Level.ERROR, "Unhandled controller exception", exception);
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, INTERNAL_ERROR_CODE, INTERNAL_ERROR_MESSAGE);
    }

    private static HttpStatus businessStatus(ErrorCode errorCode) {
        if (errorCode == SessionErrorCode.NOT_FOUND) {
            return HttpStatus.NOT_FOUND;
        }
        if (errorCode == SessionErrorCode.BUSY || errorCode == SessionErrorCode.INACTIVE) {
            return HttpStatus.CONFLICT;
        }
        return HttpStatus.BAD_REQUEST;
    }

    private static ProblemDetail problem(HttpStatus status, int code, String message) {
        ProblemDetail detail = ProblemDetail.forStatusAndDetail(status, message);
        detail.setProperty("code", code);
        return detail;
    }
}
