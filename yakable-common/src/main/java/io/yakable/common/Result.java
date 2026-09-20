package io.yakable.common;

import io.yakable.common.enums.common.CommonErrorCode;
import io.yakable.common.exception.BusinessException;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/**
 * 统一接口返回结果。
 *
 * @param <T> 返回数据类型
 */
@Getter
@Setter
@NoArgsConstructor
@ToString(callSuper = true)
@EqualsAndHashCode(callSuper = true)
public class Result<T> extends BaseResult {

    /**
     * 返回的业务数据。
     */
    protected T data;

    private Result(Integer code, String message) {
        this.code = code;
        this.message = message;
    }

    public static <T> Result<T> build(boolean success) {
        return success ? success() : fail();
    }

    public static <T> Result<T> success(T data) {
        Result<T> result = success();
        result.setData(data);
        return result;
    }

    public static <T> Result<T> success() {
        return new Result<>(CommonErrorCode.SUCCESS.getCode(), CommonErrorCode.SUCCESS.getMessage());
    }

    public static <T> Result<T> fail(ErrorCode errorCode) {
        return errorCode == null ? fail() : new Result<>(errorCode.getCode(), errorCode.getMessage());
    }

    public static <T> Result<T> fail(Integer code, String message) {
        return new Result<>(code, message);
    }

    public static <T> Result<T> fail(String message) {
        return new Result<>(CommonErrorCode.COMMON_FAIL.getCode(), message);
    }

    public static <T> Result<T> fail() {
        return fail(CommonErrorCode.COMMON_FAIL);
    }

    public static <T> Result<T> fail(BusinessException exception) {
        if (exception == null) {
            return fail();
        }
        if (exception.getErrorCode() != null) {
            return fail(exception.getErrorCode());
        }
        String message = exception.getMessage();
        return message == null || message.isBlank() ? fail() : fail(message);
    }

    public static <T> Result<T> buildFrom(Result<?> source) {
        return source == null ? fail() : new Result<>(source.getCode(), source.getMessage());
    }

    public static <T> Result<T> buildParamIllegal(String message) {
        String detail = message == null ? "" : message.trim();
        String resultMessage = CommonErrorCode.PARAM_NOT_VALID.getMessage()
                + (detail.isEmpty() ? "" : ": " + detail);
        return new Result<>(CommonErrorCode.PARAM_NOT_VALID.getCode(), resultMessage);
    }

    public static <T> Result<T> buildNotExist(String message) {
        return new Result<>(CommonErrorCode.RESOURCE_NOT_EXISTS.getCode(), message);
    }

    public static <T> Result<T> buildDuplicate(String message) {
        return new Result<>(CommonErrorCode.RESOURCE_DUPLICATION.getCode(), message);
    }

    public boolean succeeded() {
        return CommonErrorCode.SUCCESS.getCode().equals(getCode());
    }

    public boolean duplicate() {
        return CommonErrorCode.RESOURCE_DUPLICATION.getCode().equals(getCode());
    }

    public boolean failed() {
        return !succeeded();
    }
}
