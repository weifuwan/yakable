package io.yakable.boot.controller;

import io.yakable.common.exception.SessionException;
import io.yakable.service.session.SessionErrorCode;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class RestExceptionHandler {

    @ExceptionHandler(SessionException.class)
    ProblemDetail handleSessionException(SessionException exception) {
        HttpStatus status = exception.getErrorCode() == SessionErrorCode.NOT_FOUND
                ? HttpStatus.NOT_FOUND
                : HttpStatus.CONFLICT;
        ProblemDetail detail = ProblemDetail.forStatusAndDetail(status, exception.getErrorCode().getMessage());
        detail.setProperty("code", exception.getErrorCode().getCode());
        return detail;
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ProblemDetail handleBadRequest(IllegalArgumentException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
    }
}
