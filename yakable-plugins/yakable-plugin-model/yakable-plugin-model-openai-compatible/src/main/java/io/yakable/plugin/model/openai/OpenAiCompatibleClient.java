package io.yakable.plugin.model.openai;

import com.fasterxml.jackson.databind.JsonNode;
import io.yakable.common.utils.JsonUtils;
import io.yakable.common.utils.StringUtils;
import io.yakable.core.llm.LlmMessage;
import io.yakable.core.llm.LlmProviderConfiguration;
import io.yakable.core.llm.LlmRequest;
import io.yakable.core.llm.LlmResponse;
import io.yakable.core.llm.LlmStreamEvent;
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
import java.util.function.Consumer;
import java.util.stream.Stream;

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
        validateConfiguration(normalizedProviderName, configuration);
        Objects.requireNonNull(request, "request");

        HttpResponse<String> response = send(
                request(configuration, request, false), HttpResponse.BodyHandlers.ofString(), normalizedProviderName);
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new ModelPluginException(normalizedProviderName + " returned HTTP " + response.statusCode() + ".");
        }
        return readResponse(normalizedProvider, normalizedProviderName, request, response.body());
    }

    /**
     * 调用 OpenAI-compatible 流式 Chat Completions 接口。
     */
    public void streamingChat(
            String provider, String providerName, LlmProviderConfiguration configuration, LlmRequest request,
            Consumer<LlmStreamEvent> consumer) {
        String normalizedProvider = StringUtils.requireText(provider, "provider");
        String normalizedProviderName = StringUtils.requireText(providerName, "providerName");
        validateConfiguration(normalizedProviderName, configuration);
        Objects.requireNonNull(request, "request");
        Objects.requireNonNull(consumer, "consumer");

        HttpResponse<Stream<String>> response = send(
                request(configuration, request, true), HttpResponse.BodyHandlers.ofLines(), normalizedProviderName);
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            response.body().close();
            throw new ModelPluginException(normalizedProviderName + " returned HTTP " + response.statusCode() + ".");
        }

        StringBuilder content = new StringBuilder();
        String responseModel = request.model();
        String requestId = null;
        String finishReason = null;
        LlmUsage usage = new LlmUsage(null, null, null);

        try (Stream<String> lines = response.body()) {
            var iterator = lines.iterator();
            while (iterator.hasNext()) {
                String line = iterator.next();
                if (line.isBlank() || line.startsWith(":") || !line.startsWith("data:")) {
                    continue;
                }

                String data = line.substring(5).stripLeading();
                if ("[DONE]".equals(data)) {
                    break;
                }

                JsonNode payload = parseStreamPayload(normalizedProviderName, data);
                JsonNode choice = payload.path("choices").path(0);
                JsonNode deltaNode = choice.path("delta").path("content");
                if (deltaNode.isTextual() && !deltaNode.asText().isEmpty()) {
                    String delta = deltaNode.asText();
                    content.append(delta);
                    consumer.accept(LlmStreamEvent.delta(delta));
                }

                String model = JsonUtils.textValue(payload.get("model"));
                String id = JsonUtils.textValue(payload.get("id"));
                String reason = JsonUtils.textValue(choice.get("finish_reason"));
                if (model != null) responseModel = model;
                if (id != null) requestId = id;
                if (reason != null) finishReason = reason;

                JsonNode usageNode = payload.get("usage");
                if (usageNode != null && usageNode.isObject()) {
                    usage = new LlmUsage(
                            JsonUtils.longValue(usageNode.get("prompt_tokens")),
                            JsonUtils.longValue(usageNode.get("completion_tokens")),
                            JsonUtils.longValue(usageNode.get("total_tokens")));
                }
            }
        }

        if (StringUtils.isBlank(content.toString())) {
            throw new ModelPluginException(normalizedProviderName + " returned no assistant text.");
        }
        consumer.accept(LlmStreamEvent.complete(
                new LlmResponse(normalizedProvider, responseModel, content.toString(), usage, requestId, finishReason)));
    }

    private HttpRequest request(LlmProviderConfiguration configuration, LlmRequest request, boolean stream) {
        return HttpRequest.newBuilder()
                .uri(URI.create(configuration.baseUrl() + "/chat/completions"))
                .timeout(Duration.ofSeconds(120))
                .header("Authorization", "Bearer " + configuration.apiKey())
                .header("Content-Type", "application/json")
                .header("Accept", stream ? "text/event-stream" : "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(writeRequestBody(request, stream)))
                .build();
    }

    private String writeRequestBody(LlmRequest request, boolean stream) {
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
        body.put("stream", stream);

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

    private static JsonNode parseStreamPayload(String providerName, String data) {
        try {
            return JsonUtils.parseTree(data);
        } catch (RuntimeException exception) {
            throw new ModelPluginException(providerName + " returned invalid stream JSON.", exception);
        }
    }

    private static void validateConfiguration(String providerName, LlmProviderConfiguration configuration) {
        Objects.requireNonNull(configuration, "configuration");
        if (StringUtils.isBlank(configuration.apiKey())) {
            throw new ModelPluginException(providerName + " API key is not configured.");
        }
        if (StringUtils.isBlank(configuration.baseUrl())) {
            throw new ModelPluginException(providerName + " base URL is not configured.");
        }
    }

    private <T> HttpResponse<T> send(
            HttpRequest request, HttpResponse.BodyHandler<T> handler, String providerName) {
        try {
            return httpClient.send(request, handler);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new ModelPluginException(providerName + " request was interrupted.", exception);
        } catch (IOException exception) {
            throw new ModelPluginException("Unable to call " + providerName + ".", exception);
        }
    }

    private static String roleName(LlmMessage.Role role) {
        return switch (role) {
            case USER -> "user";
            case ASSISTANT -> "assistant";
        };
    }
}
