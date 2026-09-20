package io.yakable.common.exception;

/**
 * 统一业务异常。
 *
 * <p>Service 中可预期的业务错误统一抛出该异常，避免混用
 * {@link IllegalArgumentException}、{@link IllegalStateException} 等通用异常。</p>
 */
public class BusinessException extends RuntimeException {

    public BusinessException(String message) {
        super(message);
    }

    public BusinessException(String message, Throwable cause) {
        super(message, cause);
    }
}
