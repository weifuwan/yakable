package io.yakable.plugin.model.api;

import io.yakable.core.llm.LlmProvider;

/**
 * Model Plugin 扩展契约。
 *
 * <p>LLM 请求和响应契约统一由 yakable-core 定义，ModelPlugin 只补充插件元数据。</p>
 */
public interface ModelPlugin extends LlmProvider {

    /**
     * 返回 Provider 插件描述信息。
     */
    ModelPluginDescriptor descriptor();

    @Override
    default String provider() {
        return descriptor().provider();
    }
}
