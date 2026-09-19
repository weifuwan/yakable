package io.yakable.boot.llm;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.yakable.core.llm.LlmMessage;
import io.yakable.core.llm.LlmProvider;
import io.yakable.core.llm.LlmProviderException;
import io.yakable.core.llm.LlmRequest;
import io.yakable.core.llm.LlmResponse;
import io.yakable.core.llm.LlmUsage;

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

public final class DeepSeekLlmProvider implements LlmProvider {

    private static final String PROVIDER = "deepseek";

    private final DeepSeekProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public DeepSeekLlmProvider(
            DeepSeekProperties properties,
            ObjectMapper objectMapper
    ) {
        this(
                properties,
                objectMapper,
                HttpClient.newBuilder()
                        .connectTimeout(Duration.ofSeconds(20))
                        .build()
        );
    }

    DeepSeekLlmProvider(
            DeepSeekProperties properties,
            ObjectMapper objectMapper,
            HttpClient httpClient
    ) {
        this.properties = Objects.requireNonNull(properties, "properties");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
        this.httpClient = Objects.requireNonNull(httpClient, "httpClient");
    }

    @Override
    public String provider() {
        return PROVIDER;
    }

    @Override
    public LlmResponse chat(LlmRequest request) {
        Objects.requireNonNull(request, "request");

        if (properties.apiKey().isBlank()) {
            throw new LlmProviderException(
                    "DeepSeek API key is not configured. Set DEEPSEEK_API_KEY."
            );
        }

        String requestBody = writeRequestBody(request);
        HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(properties.baseUrl() + "/chat/completions"))
                .timeout(Duration.ofSeconds(120))
                .header("Authorization", "Bearer " + properties.apiKey())
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

        HttpResponse<String> response;
        try {
            response = httpClient.send(
                    httpRequest,
                    HttpResponse.BodyHandlers.ofString()
            );
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new LlmProviderException("DeepSeek request was interrupted.", exception);
        } catch (IOException exception) {
            throw new LlmProviderException("Unable to call DeepSeek.", exception);
        }

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new LlmProviderException(
                    "DeepSeek returned HTTP " + response.statusCode() + "."
            );
        }

        return readResponse(response.body());
    }

    private String writeRequestBody(LlmRequest request) {
        List<Map<String, String>> messages = new ArrayList<>();

        if (request.system() != null) {
            messages.add(Map.of(
                    "role", "system",
                    "content", request.system()
            ));
        }

        for (LlmMessage message : request.messages()) {
            messages.add(Map.of(
                    "role", roleName(message.role()),
                    "content", message.content()
            ));
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", request.model());
        body.put("messages", messages);
        body.put("stream", false);

        try {
            return objectMapper.writeValueAsString(body);
        } catch (JsonProcessingException exception) {
            throw new LlmProviderException(
                    "Unable to serialize DeepSeek request.",
                    exception
            );
        }
    }

    private LlmResponse readResponse(String body) {
        JsonNode payload;
        try {
            payload = objectMapper.readTree(body);
        } catch (JsonProcessingException exception) {
            throw new LlmProviderException(
                    "DeepSeek returned invalid JSON.",
                    exception
            );
        }

        JsonNode contentNode = payload.path("choices")
                .path(0)
                .path("message")
                .path("content");

        if (!contentNode.isTextual() || contentNode.asText().isBlank()) {
            throw new LlmProviderException(
                    "DeepSeek returned no assistant text."
            );
        }

        JsonNode usage = payload.path("usage");
        return new LlmResponse(
                contentNode.asText(),
                new LlmUsage(
                        longValue(usage.get("prompt_tokens")),
                        longValue(usage.get("completion_tokens")),
                        longValue(usage.get("total_tokens"))
                )
        );
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
}
