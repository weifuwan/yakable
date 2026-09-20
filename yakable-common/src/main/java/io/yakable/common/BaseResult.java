package io.yakable.common;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 统一接口返回基础结果。
 */
@Getter
@Setter
@NoArgsConstructor
public class BaseResult {

    /**
     * 业务状态码。
     */
    protected Integer code;

    /**
     * 提示信息。
     */
    protected String message;
}
