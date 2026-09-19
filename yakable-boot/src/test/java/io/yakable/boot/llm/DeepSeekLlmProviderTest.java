package io.yakable.boot.llm;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import io.yakable.core.llm.LlmMessage;
import io.yakable.core.llm.LlmRequest;
import io.yakable.core.llm.LlmResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class DeepSeekLlmProviderTest {

    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void mapsUnifiedMessagesToDeepSeekAndBack() throws Exception {
        AtomicReference<String> authorization = new AtomicReference<>();
        AtomicReference<String> requestBody = new AtomicReference<>();

        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/chat/completions", exchange -> {
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            requestBody.set(new String(
                    exchange.getRequestBody().readAllBytes(),
                    StandardCharsets.UTF_8
            ));

            byte[] response = """
                    {
                      "choices": [
                        {
                          "message": {
                            "role": "assistant",
                            "content": "Hello from DeepSeek"
                          }
                        }
                      ],
                      "usage": {
                        "prompt_tokens": 10,
                        "completion_tokens": 5,
                        "total_tokens": 15
                      }
                    }
                    """.getBytes(StandardCharsets.UTF_8);

            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();

        ObjectMapper objectMapper = new ObjectMapper();
        DeepSeekLlmProvider provider = new DeepSeekLlmProvider(
                new DeepSeekProperties(
                        "test-key",
                        "http://127.0.0.1:" + server.getAddress().getPort()
                ),
                objectMapper
        );

        LlmResponse response = provider.chat(
                new LlmRequest(
                        "deepseek-flash",
                        "You are Yakable.",
                        List.of(
                                new LlmMessage(
                                        LlmMessage.Role.USER,
                                        "Hello"
                                )
                        )
                )
        );

        assertThat(authorization.get()).isEqualTo("Bearer test-key");
        assertThat(response.content()).isEqualTo("Hello from DeepSeek");
        assertThat(response.usage().totalTokens()).isEqualTo(15L);

        JsonNode request = objectMapper.readTree(requestBody.get());
        assertThat(request.path("model").asText()).isEqualTo("deepseek-flash");
        assertThat(request.path("stream").asBoolean()).isFalse();
        assertThat(request.path("messages").path(0).path("role").asText())
                .isEqualTo("system");
        assertThat(request.path("messages").path(1).path("role").asText())
                .isEqualTo("user");
        assertThat(request.path("messages").path(1).path("content").asText())
                .isEqualTo("Hello");
    }
}
