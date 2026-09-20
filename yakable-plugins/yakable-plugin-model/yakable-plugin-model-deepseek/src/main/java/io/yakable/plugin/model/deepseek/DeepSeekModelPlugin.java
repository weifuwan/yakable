package io.yakable.plugin.model.deepseek;

import com.google.auto.service.AutoService;
import io.yakable.core.llm.LlmProvider;
import io.yakable.core.llm.LlmProviderConfiguration;
import io.yakable.core.llm.LlmRequest;
import io.yakable.core.llm.LlmResponse;
import io.yakable.plugin.model.api.ModelCapability;
import io.yakable.plugin.model.api.ModelPlugin;
import io.yakable.plugin.model.api.ModelPluginDescriptor;
import io.yakable.plugin.model.openai.OpenAiCompatibleClient;

import java.util.Set;

@AutoService({LlmProvider.class, ModelPlugin.class})
public final class DeepSeekModelPlugin implements ModelPlugin {

    public static final String PROVIDER = "deepseek";
    public static final String DEFAULT_BASE_URL = "https://api.deepseek.com";

    private static final ModelPluginDescriptor DESCRIPTOR =
            new ModelPluginDescriptor(
                    PROVIDER,
                    "DeepSeek",
                    ModelPluginDescriptor.CURRENT_API_VERSION,
                    Set.of(ModelCapability.CHAT)
            );

    private final OpenAiCompatibleClient client = new OpenAiCompatibleClient();

    @Override
    public ModelPluginDescriptor descriptor() {
        return DESCRIPTOR;
    }

    @Override
    public LlmResponse chat(LlmProviderConfiguration configuration, LlmRequest request) {
        String baseUrl = configuration.baseUrl().isBlank() ? DEFAULT_BASE_URL : configuration.baseUrl();
        return client.chat(
                DESCRIPTOR.provider(),
                DESCRIPTOR.displayName(),
                new LlmProviderConfiguration(configuration.apiKey(), baseUrl),
                request);
    }
}
