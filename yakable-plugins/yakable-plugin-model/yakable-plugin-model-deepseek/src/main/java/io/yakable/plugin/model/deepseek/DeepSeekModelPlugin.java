package io.yakable.plugin.model.deepseek;

import com.google.auto.service.AutoService;
import io.yakable.common.utils.StringUtils;
import io.yakable.core.llm.LlmModelMetadata;
import io.yakable.core.llm.LlmProvider;
import io.yakable.core.llm.LlmProviderConfiguration;
import io.yakable.core.llm.LlmRequest;
import io.yakable.core.llm.LlmResponse;
import io.yakable.core.llm.LlmStreamEvent;
import io.yakable.plugin.model.api.ModelCapability;
import io.yakable.plugin.model.api.ModelPlugin;
import io.yakable.plugin.model.api.ModelPluginDescriptor;
import io.yakable.plugin.model.api.ModelPluginException;
import io.yakable.plugin.model.openai.OpenAiCompatibleClient;

import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;

@AutoService({LlmProvider.class, ModelPlugin.class})
public final class DeepSeekModelPlugin implements ModelPlugin {

    public static final String PROVIDER = "deepseek";
    public static final String DEFAULT_BASE_URL = "https://api.deepseek.com";

    private static final ModelPluginDescriptor DESCRIPTOR = new ModelPluginDescriptor(
            PROVIDER, "DeepSeek", ModelPluginDescriptor.CURRENT_API_VERSION, Set.of(ModelCapability.CHAT));

    // Context / output limits follow the current DeepSeek API model specification.
    private static final Map<String, LlmModelMetadata> MODELS = Map.of(
            "deepseek-flash", new LlmModelMetadata(1_000_000L, 65_536L));
    // DeepSeek publishes approximate character/token ratios; keep extra headroom because this is not an exact tokenizer.
    private static final double TOKEN_ESTIMATE_SAFETY_FACTOR = 1.5;
    private static final long MESSAGE_OVERHEAD_TOKENS = 4L;
    private static final long REQUEST_OVERHEAD_TOKENS = 2L;

    private final OpenAiCompatibleClient client = new OpenAiCompatibleClient();

    @Override
    public ModelPluginDescriptor descriptor() {
        return DESCRIPTOR;
    }

    @Override
    public LlmModelMetadata modelMetadata(String model) {
        LlmModelMetadata metadata = MODELS.get(model);
        if (metadata == null) {
            throw new ModelPluginException("Model context metadata not found: " + PROVIDER + "/" + model);
        }
        return metadata;
    }

    @Override
    public long estimateTokens(LlmRequest request) {
        double tokens = REQUEST_OVERHEAD_TOKENS;
        if (request.system() != null) {
            tokens += MESSAGE_OVERHEAD_TOKENS + estimateTextTokens(request.system());
        }
        for (var message : request.messages()) {
            tokens += MESSAGE_OVERHEAD_TOKENS + estimateTextTokens(message.content());
        }
        return Math.max(1L, (long) Math.ceil(tokens * TOKEN_ESTIMATE_SAFETY_FACTOR));
    }

    @Override
    public LlmResponse chat(LlmProviderConfiguration configuration, LlmRequest request) {
        return client.chat(DESCRIPTOR.provider(), DESCRIPTOR.displayName(), configuration(configuration), request);
    }

    @Override
    public void streamingChat(
            LlmProviderConfiguration configuration, LlmRequest request, Consumer<LlmStreamEvent> consumer) {
        client.streamingChat(
                DESCRIPTOR.provider(), DESCRIPTOR.displayName(), configuration(configuration), request, consumer);
    }

    private static double estimateTextTokens(String text) {
        double tokens = 0;
        for (int offset = 0; offset < text.length(); ) {
            int codePoint = text.codePointAt(offset);
            tokens += Character.UnicodeScript.of(codePoint) == Character.UnicodeScript.HAN ? 0.6 : 0.3;
            offset += Character.charCount(codePoint);
        }
        return tokens;
    }

    private static LlmProviderConfiguration configuration(LlmProviderConfiguration configuration) {
        String baseUrl = StringUtils.isBlank(configuration.baseUrl()) ? DEFAULT_BASE_URL : configuration.baseUrl();
        return new LlmProviderConfiguration(configuration.apiKey(), baseUrl);
    }
}
