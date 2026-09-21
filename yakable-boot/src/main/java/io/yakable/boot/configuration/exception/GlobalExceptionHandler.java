package io.yakable.boot.configuration.exception;

import io.yakable.common.ErrorCode;
import io.yakable.common.Result;
import io.yakable.common.enums.auth.AuthErrorCode;
import io.yakable.common.enums.common.CommonErrorCode;
import io.yakable.common.enums.project.ProjectErrorCode;
import io.yakable.common.enums.session.SessionErrorCode;
import io.yakable.common.exception.BusinessException;
import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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

    @ExceptionHandler(BusinessException.class)
    ResponseEntity<Result<Void>> handleBusinessException(BusinessException exception) {
        ErrorCode errorCode = exception.getErrorCode();
        if (errorCode == null) {
            log.log(System.Logger.Level.WARNING, "Business exception without ErrorCode", exception);
            return ResponseEntity.badRequest().body(Result.<Void>fail(CommonErrorCode.PARAM_NOT_VALID));
        }
        return ResponseEntity.status(businessStatus(errorCode)).body(Result.<Void>fail(errorCode));
    }

    @ExceptionHandler({
            MethodArgumentNotValidException.class,
            ConstraintViolationException.class,
            HttpMessageNotReadableException.class,
            IllegalArgumentException.class
    })
    ResponseEntity<Result<Void>> handleInvalidRequest(Exception exception) {
        log.log(System.Logger.Level.DEBUG, "Invalid request", exception);
        return ResponseEntity.badRequest().body(Result.<Void>fail(CommonErrorCode.PARAM_NOT_VALID));
    }

    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<Result<Void>> handleResponseStatus(ResponseStatusException exception) {
        HttpStatus status = HttpStatus.resolve(exception.getStatusCode().value());
        HttpStatus resolved = status == null ? HttpStatus.BAD_REQUEST : status;
        CommonErrorCode errorCode = resolved == HttpStatus.NOT_FOUND
                ? CommonErrorCode.RESOURCE_NOT_EXISTS
                : CommonErrorCode.PARAM_NOT_VALID;
        return ResponseEntity.status(resolved).body(Result.<Void>fail(errorCode));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<Result<Void>> handleUnexpectedException(Exception exception) {
        log.log(System.Logger.Level.ERROR, "Unhandled controller exception", exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Result.<Void>fail(CommonErrorCode.COMMON_FAIL));
    }

    private static HttpStatus businessStatus(ErrorCode errorCode) {
        if (errorCode == AuthErrorCode.UNAUTHORIZED || errorCode == AuthErrorCode.INVALID_CREDENTIALS) {
            return HttpStatus.UNAUTHORIZED;
        }
        if (errorCode == AuthErrorCode.ACCOUNT_DISABLED || errorCode == AuthErrorCode.FORBIDDEN) {
            return HttpStatus.FORBIDDEN;
        }
        if (errorCode == ProjectErrorCode.NOT_FOUND || errorCode == SessionErrorCode.NOT_FOUND) {
            return HttpStatus.NOT_FOUND;
        }
        if (errorCode == SessionErrorCode.BUSY || errorCode == SessionErrorCode.INACTIVE) {
            return HttpStatus.CONFLICT;
        }
        return HttpStatus.BAD_REQUEST;
    }
}
