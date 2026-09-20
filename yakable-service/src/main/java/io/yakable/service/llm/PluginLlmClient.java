package io.yakable.service.llm;

import io.yakable.common.utils.StringUtils;
import io.yakable.core.llm.LlmClient;
import io.yakable.core.llm.LlmProvider;
import io.yakable.core.llm.LlmProviderConfiguration;
import io.yakable.core.llm.LlmRequest;
import io.yakable.core.llm.LlmResponse;
import jakarta.annotation.Resource;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.ServiceLoader;

/**
 * 基于 Model Plugin 的 LLM Client 实现。
 */
@Component
public class PluginLlmClient implements LlmClient {

    private final Map<String, LlmProvider> providers = loadProviders();

    @Resource
    private Environment environment;

    @Override
    public LlmResponse chat(LlmRequest request) {
        LlmProvider provider = requireProvider(request.provider());
        return provider.chat(configuration(provider.provider()), request);
    }

    private LlmProviderConfiguration configuration(String provider) {
        String prefix = "yakable.model.providers." + normalize(provider) + ".";
        return new LlmProviderConfiguration(
                environment.getProperty(prefix + "api-key", ""), environment.getProperty(prefix + "base-url", ""));
    }

    private LlmProvider requireProvider(String provider) {
        String key = normalize(provider);
        LlmProvider result = providers.get(key);
        if (result == null) {
            throw new IllegalArgumentException("LLM provider not found: " + key);
        }
        return result;
    }

    private static Map<String, LlmProvider> loadProviders() {
        Map<String, LlmProvider> result = new LinkedHashMap<>();
        for (LlmProvider provider : ServiceLoader.load(LlmProvider.class)) {
            String key = normalize(provider.provider());
            if (result.putIfAbsent(key, provider) != null) {
                throw new IllegalStateException("Duplicate LLM provider: " + key);
            }
        }
        return Map.copyOf(result);
    }

    private static String normalize(String provider) {
        return StringUtils.normalizeKey(provider, "provider");
    }
}
