package io.yakable.plugin.model.openai;

import com.fasterxml.jackson.databind.JsonNode;
import io.yakable.common.utils.JsonUtils;
import io.yakable.common.utils.StringUtils;
import io.yakable.core.llm.LlmMessage;
import io.yakable.core.llm.LlmProviderConfiguration;
import io.yakable.core.llm.LlmRequest;
import io.yakable.core.llm.LlmResponse;
import io.yakable.core.llm.LlmUsage;
import io.yakable.plugin.model.api.ModelPluginException;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * OpenAI-compatible Chat Completions 协议客户端。
 */
public final class OpenAiCompatibleClient {

    private final HttpClient httpClient;

    public OpenAiCompatibleClient() {
        this(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(20)).build());
    }

    OpenAiCompatibleClient(HttpClient httpClient) {
        this.httpClient = Objects.requireNonNull(httpClient, "httpClient");
    }

    /**
     * 调用 OpenAI-compatible Chat Completions 接口，并转换为统一 LLM 响应。
     */
    public LlmResponse chat(
            String provider, String providerName, LlmProviderConfiguration configuration, LlmRequest request) {
        String normalizedProvider = StringUtils.requireText(provider, "provider");
        String normalizedProviderName = StringUtils.requireText(providerName, "providerName");
        Objects.requireNonNull(configuration, "configuration");
        Objects.requireNonNull(request, "request");

        if (StringUtils.isBlank(configuration.apiKey())) {
            throw new ModelPluginException(normalizedProviderName + " API key is not configured.");
        }
        if (StringUtils.isBlank(configuration.baseUrl())) {
            throw new ModelPluginException(normalizedProviderName + " base URL is not configured.");
        }

        HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(configuration.baseUrl() + "/chat/completions"))
                .timeout(Duration.ofSeconds(120))
                .header("Authorization", "Bearer " + configuration.apiKey())
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(writeRequestBody(request)))
                .build();

        HttpResponse<String> response;
        try {
            response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new ModelPluginException(normalizedProviderName + " request was interrupted.", exception);
        } catch (IOException exception) {
            throw new ModelPluginException("Unable to call " + normalizedProviderName + ".", exception);
        }

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new ModelPluginException(normalizedProviderName + " returned HTTP " + response.statusCode() + ".");
        }

        return readResponse(normalizedProvider, normalizedProviderName, request, response.body());
    }

    private String writeRequestBody(LlmRequest request) {
        List<Map<String, String>> messages = new ArrayList<>();
        if (request.system() != null) {
            messages.add(Map.of("role", "system", "content", request.system()));
        }
        for (LlmMessage message : request.messages()) {
            messages.add(Map.of("role", roleName(message.role()), "content", message.content()));
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", request.model());
        body.put("messages", messages);
        body.put("stream", false);

        try {
            return JsonUtils.toJson(body);
        } catch (RuntimeException exception) {
            throw new ModelPluginException("Unable to serialize OpenAI-compatible request.", exception);
        }
    }

    private LlmResponse readResponse(String provider, String providerName, LlmRequest request, String body) {
        JsonNode payload;
        try {
            payload = JsonUtils.parseTree(body);
        } catch (RuntimeException exception) {
            throw new ModelPluginException(providerName + " returned invalid JSON.", exception);
        }

        JsonNode choice = payload.path("choices").path(0);
        JsonNode contentNode = choice.path("message").path("content");
        if (!contentNode.isTextual() || StringUtils.isBlank(contentNode.asText())) {
            throw new ModelPluginException(providerName + " returned no assistant text.");
        }

        JsonNode usage = payload.path("usage");
        String model = JsonUtils.textValue(payload.get("model"));
        return new LlmResponse(
                provider, model == null ? request.model() : model, contentNode.asText(),
                new LlmUsage(
                        JsonUtils.longValue(usage.get("prompt_tokens")),
                        JsonUtils.longValue(usage.get("completion_tokens")),
                        JsonUtils.longValue(usage.get("total_tokens"))),
                JsonUtils.textValue(payload.get("id")), JsonUtils.textValue(choice.get("finish_reason")));
    }

    private static String roleName(LlmMessage.Role role) {
        return switch (role) {
            case USER -> "user";
            case ASSISTANT -> "assistant";
        };
    }
}
