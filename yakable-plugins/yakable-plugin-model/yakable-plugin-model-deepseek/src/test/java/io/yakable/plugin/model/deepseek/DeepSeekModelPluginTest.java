package io.yakable.plugin.model.deepseek;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import io.yakable.plugin.model.api.LlmMessage;
import io.yakable.plugin.model.api.LlmRequest;
import io.yakable.plugin.model.api.LlmResponse;
import io.yakable.plugin.model.api.ModelPluginConfiguration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class DeepSeekModelPluginTest {

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
                      "id": "chatcmpl-deepseek-1",
                      "model": "deepseek-flash",
                      "choices": [
                        {
                          "message": {
                            "role": "assistant",
                            "content": "Hello from DeepSeek"
                          },
                          "finish_reason": "stop"
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

        DeepSeekModelPlugin plugin = new DeepSeekModelPlugin();

        LlmResponse response = plugin.chat(
                new ModelPluginConfiguration(
                        "test-key",
                        "http://127.0.0.1:" + server.getAddress().getPort()
                ),
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
        assertThat(response.model()).isEqualTo("deepseek-flash");
        assertThat(response.providerRequestId())
                .isEqualTo("chatcmpl-deepseek-1");
        assertThat(response.finishReason()).isEqualTo("stop");

        JsonNode request = new ObjectMapper().readTree(requestBody.get());
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
