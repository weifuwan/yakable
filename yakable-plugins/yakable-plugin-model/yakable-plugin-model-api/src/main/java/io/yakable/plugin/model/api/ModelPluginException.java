package io.yakable.plugin.model.api;

/**
 * Model Plugin 调用异常。
 */
public class ModelPluginException extends RuntimeException {

    public ModelPluginException(String message) {
        super(message);
    }

    public ModelPluginException(String message, Throwable cause) {
        super(message, cause);
    }
}
