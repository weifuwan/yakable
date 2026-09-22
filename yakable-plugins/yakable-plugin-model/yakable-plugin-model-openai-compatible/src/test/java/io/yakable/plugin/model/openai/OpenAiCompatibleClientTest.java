package io.yakable.plugin.model.openai;

import io.yakable.core.llm.LlmMessage;
import io.yakable.core.llm.LlmProviderConfiguration;
import io.yakable.core.llm.LlmRequest;
import io.yakable.core.llm.LlmResponse;
import io.yakable.core.llm.LlmStreamEvent;
import io.yakable.plugin.model.api.ModelPluginException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OpenAiCompatibleClientTest {

    @Mock
    private HttpClient httpClient;

    private OpenAiCompatibleClient client;

    @BeforeEach
    void setUp() {
        client = new OpenAiCompatibleClient(httpClient);
    }

    @Test
    void shouldConvertSuccessfulChatResponse() throws Exception {
        HttpResponse<String> response = stringResponse(
                200,
                """
                {
                  "id": "req-1",
                  "model": "deepseek-flash",
                  "choices": [
                    {
                      "message": {
                        "content": "Hello"
                      },
                      "finish_reason": "stop"
                    }
                  ],
                  "usage": {
                    "prompt_tokens": 10,
                    "completion_tokens": 2,
                    "total_tokens": 12
                  }
                }
                """);
        stubResponse(response);

        LlmResponse result = client.chat(
                "deepseek",
                "DeepSeek",
                new LlmProviderConfiguration("api-key", "https://example.test"),
                request());

        assertThat(result.provider()).isEqualTo("deepseek");
        assertThat(result.model()).isEqualTo("deepseek-flash");
        assertThat(result.content()).isEqualTo("Hello");
        assertThat(result.usage().inputTokens()).isEqualTo(10L);
        assertThat(result.usage().outputTokens()).isEqualTo(2L);
        assertThat(result.usage().totalTokens()).isEqualTo(12L);
        assertThat(result.providerRequestId()).isEqualTo("req-1");
        assertThat(result.finishReason()).isEqualTo("stop");

        ArgumentCaptor<HttpRequest> requestCaptor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(httpClient).send(requestCaptor.capture(), any(HttpResponse.BodyHandler.class));
        HttpRequest httpRequest = requestCaptor.getValue();

        assertThat(httpRequest.uri()).isEqualTo(URI.create("https://example.test/chat/completions"));
        assertThat(httpRequest.headers().firstValue("Authorization")).contains("Bearer api-key");
        assertThat(httpRequest.headers().firstValue("Accept")).contains("application/json");
    }

    @Test
    void shouldRejectNonSuccessfulChatStatus() throws Exception {
        @SuppressWarnings("unchecked")
        HttpResponse<String> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(401);
        stubResponse(response);

        assertThatThrownBy(() -> client.chat(
                "deepseek",
                "DeepSeek",
                new LlmProviderConfiguration("api-key", "https://example.test"),
                request()))
                .isInstanceOf(ModelPluginException.class)
                .hasMessage("DeepSeek returned HTTP 401.");
    }

    @Test
    void shouldConvertStreamingDeltasAndCompletion() throws Exception {
        HttpResponse<Stream<String>> response = streamResponse(
                200,
                Stream.of(
                        "data: {\"id\":\"req-2\",\"model\":\"deepseek-flash\",\"choices\":[{\"delta\":{\"content\":\"Hel\"},\"finish_reason\":null}]}",
                        "data: {\"choices\":[{\"delta\":{\"content\":\"lo\"},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":10,\"completion_tokens\":2,\"total_tokens\":12}}",
                        "data: [DONE]"));
        stubResponse(response);

        List<LlmStreamEvent> events = new ArrayList<>();

        client.streamingChat(
                "deepseek",
                "DeepSeek",
                new LlmProviderConfiguration("api-key", "https://example.test"),
                request(),
                events::add);

        assertThat(events).hasSize(3);
        assertThat(events.get(0).type()).isEqualTo(LlmStreamEvent.Type.DELTA);
        assertThat(events.get(0).delta()).isEqualTo("Hel");
        assertThat(events.get(1).type()).isEqualTo(LlmStreamEvent.Type.DELTA);
        assertThat(events.get(1).delta()).isEqualTo("lo");

        LlmStreamEvent complete = events.get(2);
        assertThat(complete.type()).isEqualTo(LlmStreamEvent.Type.COMPLETE);
        assertThat(complete.response().content()).isEqualTo("Hello");
        assertThat(complete.response().providerRequestId()).isEqualTo("req-2");
        assertThat(complete.response().finishReason()).isEqualTo("stop");
        assertThat(complete.response().usage().totalTokens()).isEqualTo(12L);
    }

    @Test
    void shouldRejectStreamingResponseWithoutAssistantText() throws Exception {
        HttpResponse<Stream<String>> response = streamResponse(
                200,
                Stream.of(
                        "data: {\"id\":\"req-3\",\"model\":\"deepseek-flash\",\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}",
                        "data: [DONE]"));
        stubResponse(response);

        assertThatThrownBy(() -> client.streamingChat(
                "deepseek",
                "DeepSeek",
                new LlmProviderConfiguration("api-key", "https://example.test"),
                request(),
                event -> {
                }))
                .isInstanceOf(ModelPluginException.class)
                .hasMessage("DeepSeek returned no assistant text.");
    }

    private static LlmRequest request() {
        return new LlmRequest(
                "deepseek",
                "deepseek-flash",
                "You are Yakable.",
                List.of(
                        new LlmMessage(LlmMessage.Role.USER, "Hello"),
                        new LlmMessage(LlmMessage.Role.ASSISTANT, "Hi")));
    }

    @SuppressWarnings("unchecked")
    private static HttpResponse<String> stringResponse(int status, String body) {
        HttpResponse<String> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(status);
        when(response.body()).thenReturn(body);
        return response;
    }

    @SuppressWarnings("unchecked")
    private static HttpResponse<Stream<String>> streamResponse(int status, Stream<String> body) {
        HttpResponse<Stream<String>> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(status);
        when(response.body()).thenReturn(body);
        return response;
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private void stubResponse(HttpResponse<?> response) throws Exception {
        doReturn(response)
                .when(httpClient)
                .send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class));
    }
}
