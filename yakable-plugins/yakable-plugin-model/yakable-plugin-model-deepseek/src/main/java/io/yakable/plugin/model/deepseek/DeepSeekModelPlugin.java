package io.yakable.plugin.model.deepseek;

import com.google.auto.service.AutoService;
import io.yakable.plugin.model.api.LlmRequest;
import io.yakable.plugin.model.api.LlmResponse;
import io.yakable.plugin.model.api.ModelCapability;
import io.yakable.plugin.model.api.ModelPlugin;
import io.yakable.plugin.model.api.ModelPluginConfiguration;
import io.yakable.plugin.model.api.ModelPluginDescriptor;
import io.yakable.plugin.model.openai.OpenAiCompatibleClient;

import java.util.Set;

@AutoService(ModelPlugin.class)
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
    public LlmResponse chat(
            ModelPluginConfiguration configuration,
            LlmRequest request
    ) {
        String baseUrl = configuration.baseUrl().isBlank()
                ? DEFAULT_BASE_URL
                : configuration.baseUrl();

        return client.chat(
                DESCRIPTOR.displayName(),
                new ModelPluginConfiguration(
                        configuration.apiKey(),
                        baseUrl
                ),
                request
        );
    }
}
