package io.yakable.plugin.model.openai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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

public final class OpenAiCompatibleClient {

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public OpenAiCompatibleClient() {
        this(
                new ObjectMapper(),
                HttpClient.newBuilder()
                        .connectTimeout(Duration.ofSeconds(20))
                        .build()
        );
    }

    OpenAiCompatibleClient(ObjectMapper objectMapper, HttpClient httpClient) {
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
        this.httpClient = Objects.requireNonNull(httpClient, "httpClient");
    }

    public LlmResponse chat(
            String provider,
            String providerName,
            LlmProviderConfiguration configuration,
            LlmRequest request) {
        String normalizedProvider = requireText(provider, "provider");
        String normalizedProviderName = requireText(providerName, "providerName");
        Objects.requireNonNull(configuration, "configuration");
        Objects.requireNonNull(request, "request");

        if (configuration.apiKey().isBlank()) {
            throw new ModelPluginException(normalizedProviderName + " API key is not configured.");
        }
        if (configuration.baseUrl().isBlank()) {
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
            throw new ModelPluginException(
                    normalizedProviderName + " returned HTTP " + response.statusCode() + ".");
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
            return objectMapper.writeValueAsString(body);
        } catch (JsonProcessingException exception) {
            throw new ModelPluginException("Unable to serialize OpenAI-compatible request.", exception);
        }
    }

    private LlmResponse readResponse(
            String provider,
            String providerName,
            LlmRequest request,
            String body) {
        JsonNode payload;
        try {
            payload = objectMapper.readTree(body);
        } catch (JsonProcessingException exception) {
            throw new ModelPluginException(providerName + " returned invalid JSON.", exception);
        }

        JsonNode choice = payload.path("choices").path(0);
        JsonNode contentNode = choice.path("message").path("content");
        if (!contentNode.isTextual() || contentNode.asText().isBlank()) {
            throw new ModelPluginException(providerName + " returned no assistant text.");
        }

        JsonNode usage = payload.path("usage");
        String model = textValue(payload.get("model"));
        return new LlmResponse(
                provider,
                model == null ? request.model() : model,
                contentNode.asText(),
                new LlmUsage(
                        longValue(usage.get("prompt_tokens")),
                        longValue(usage.get("completion_tokens")),
                        longValue(usage.get("total_tokens"))),
                textValue(payload.get("id")),
                textValue(choice.get("finish_reason")));
    }

    private static String roleName(LlmMessage.Role role) {
        return switch (role) {
            case USER -> "user";
            case ASSISTANT -> "assistant";
        };
    }

    private static Long longValue(JsonNode node) {
        return node != null && node.isNumber() ? node.longValue() : null;
    }

    private static String textValue(JsonNode node) {
        if (node == null || !node.isTextual()) {
            return null;
        }
        String value = node.asText();
        return value.isBlank() ? null : value;
    }

    private static String requireText(String value, String field) {
        Objects.requireNonNull(value, field);
        if (value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return value;
    }
}
