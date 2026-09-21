package io.yakable.boot.controller.auth;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.yakable.boot.configuration.security.AuthCookieConstant;
import io.yakable.common.Result;
import io.yakable.common.bean.dto.auth.AuthTokenDTO;
import io.yakable.common.bean.dto.auth.LoginDTO;
import io.yakable.common.bean.vo.auth.LoginVO;
import io.yakable.common.bean.vo.user.CurrentUserVO;
import io.yakable.service.auth.AuthService;
import jakarta.annotation.Resource;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.LocalDateTime;

@Tag(name = "Auth", description = "用户认证")
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Resource
    private AuthService authService;

    @Operation(summary = "用户登录")
    @PostMapping("/login")
    public Result<CurrentUserVO> login(
            @Valid @RequestBody LoginDTO dto,
            HttpServletRequest request,
            HttpServletResponse response) {
        LoginVO login = authService.login(dto);
        Duration maxAge = Duration.between(LocalDateTime.now(), login.getExpiresAt());
        response.addHeader(HttpHeaders.SET_COOKIE, sessionCookie(login.getSessionToken(), maxAge, request.isSecure()).toString());
        return Result.success(login.getUser());
    }

    @Operation(summary = "用户退出登录")
    @PostMapping("/logout")
    public Result<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        String token = sessionToken(request);
        if (token != null && !token.isBlank()) {
            authService.logout(new AuthTokenDTO(token));
        }
        response.addHeader(HttpHeaders.SET_COOKIE, sessionCookie("", Duration.ZERO, request.isSecure()).toString());
        return Result.success();
    }

    @Operation(summary = "查询当前用户")
    @GetMapping("/me")
    public Result<CurrentUserVO> queryCurrentUser(@AuthenticationPrincipal CurrentUserVO currentUser) {
        return Result.success(currentUser);
    }

    private static ResponseCookie sessionCookie(String token, Duration maxAge, boolean secure) {
        return ResponseCookie.from(AuthCookieConstant.SESSION_COOKIE, token)
                .httpOnly(true)
                .secure(secure)
                .sameSite("Strict")
                .path("/")
                .maxAge(maxAge.isNegative() ? Duration.ZERO : maxAge)
                .build();
    }

    private static String sessionToken(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (AuthCookieConstant.SESSION_COOKIE.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }
}
