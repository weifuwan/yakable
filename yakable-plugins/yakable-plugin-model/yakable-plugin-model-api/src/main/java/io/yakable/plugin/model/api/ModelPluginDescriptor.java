package io.yakable.plugin.model.api;

import io.yakable.common.utils.StringUtils;

import java.util.Objects;
import java.util.Set;

/**
 * Model Plugin 描述信息。
 *
 * @param provider Provider 唯一标识
 * @param displayName Provider 展示名称
 * @param apiVersion Plugin API 版本
 * @param capabilities Provider 支持的模型能力
 */
public record ModelPluginDescriptor(
        String provider, String displayName, String apiVersion, Set<ModelCapability> capabilities) {

    public static final String CURRENT_API_VERSION = "1";

    public ModelPluginDescriptor {
        provider = StringUtils.requireStrippedText(provider, "provider");
        displayName = StringUtils.requireStrippedText(displayName, "displayName");
        apiVersion = StringUtils.requireStrippedText(apiVersion, "apiVersion");
        Objects.requireNonNull(capabilities, "capabilities");
        capabilities = Set.copyOf(capabilities);
    }

    /**
     * 判断 Provider 是否支持指定能力。
     */
    public boolean supports(ModelCapability capability) {
        return capabilities.contains(capability);
    }
}
