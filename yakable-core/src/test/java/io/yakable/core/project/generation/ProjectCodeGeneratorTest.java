package io.yakable.core.project.generation;

import io.yakable.common.utils.JsonUtils;
import io.yakable.core.llm.LlmClient;
import io.yakable.core.llm.LlmMessage;
import io.yakable.core.llm.LlmRequest;
import io.yakable.core.llm.LlmResponse;
import io.yakable.core.llm.LlmUsage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectCodeGeneratorTest {

    @Mock
    private LlmClient llmClient;

    @InjectMocks
    private ProjectCodeGenerator generator;

    @Test
    void shouldGenerateStructuredProjectAndPreserveExecutionMetadata() {
        String appContent = "export default function App() {\n  return <main>Todo</main>\n}\n";
        String responseContent = JsonUtils.toJson(Map.of(
                "summary", "Created a Todo app",
                "files", List.of(
                        Map.of("path", "src/App.tsx", "content", appContent),
                        Map.of("path", "src/styles.css", "content", "body { margin: 0; }\n"))));
        LlmUsage usage = new LlmUsage(120L, 340L, 460L);
        when(llmClient.chat(any(LlmRequest.class)))
                .thenReturn(new LlmResponse(
                        "deepseek", "deepseek-chat", responseContent, usage, "provider-request-1", "stop"));

        ProjectCodeGenerationResult result =
                generator.generate("deepseek", "deepseek-chat", "Build a Todo app");

        assertThat(result.project().summary()).isEqualTo("Created a Todo app");
        assertThat(result.project().files()).hasSize(2);
        assertThat(result.project().files().getFirst().path()).isEqualTo("src/App.tsx");
        assertThat(result.project().files().getFirst().content()).isEqualTo(appContent);
        assertThat(result.usage()).isEqualTo(usage);
        assertThat(result.providerRequestId()).isEqualTo("provider-request-1");
        assertThat(result.finishReason()).isEqualTo("stop");

        ArgumentCaptor<LlmRequest> captor = ArgumentCaptor.forClass(LlmRequest.class);
        verify(llmClient).chat(captor.capture());
        LlmRequest request = captor.getValue();
        assertThat(request.provider()).isEqualTo("deepseek");
        assertThat(request.model()).isEqualTo("deepseek-chat");
        assertThat(request.system()).contains("Return exactly one valid JSON object");
        assertThat(request.messages()).containsExactly(
                new LlmMessage(LlmMessage.Role.USER, "Build a Todo app"));
    }

    @Test
    void shouldRejectTrailingJsonToken() {
        String valid = "{\"summary\":\"done\",\"files\":[{\"path\":\"a.txt\",\"content\":\"a\"}]}";
        when(llmClient.chat(any(LlmRequest.class))).thenReturn(response(valid + "\n{}"));

        assertThatThrownBy(() -> generator.generate("deepseek", "deepseek-chat", "Build app"))
                .isInstanceOf(ProjectCodeGenerator.ProjectCodeGenerationException.class)
                .hasMessageContaining("Invalid Project Code Generation Result");
    }

    @Test
    void shouldRejectMissingSummary() {
        when(llmClient.chat(any(LlmRequest.class)))
                .thenReturn(response("{\"files\":[{\"path\":\"a.txt\",\"content\":\"a\"}]}"));

        assertThatThrownBy(() -> generator.generate("deepseek", "deepseek-chat", "Build app"))
                .isInstanceOf(ProjectCodeGenerator.ProjectCodeGenerationException.class)
                .hasMessageContaining("summary");
    }

    @Test
    void shouldRejectEmptyFiles() {
        when(llmClient.chat(any(LlmRequest.class)))
                .thenReturn(response("{\"summary\":\"done\",\"files\":[]}"));

        assertThatThrownBy(() -> generator.generate("deepseek", "deepseek-chat", "Build app"))
                .isInstanceOf(ProjectCodeGenerator.ProjectCodeGenerationException.class)
                .hasMessageContaining("non-empty array");
    }

    @Test
    void shouldRejectNonTextFileFields() {
        when(llmClient.chat(any(LlmRequest.class)))
                .thenReturn(response("{\"summary\":\"done\",\"files\":[{\"path\":123,\"content\":{}}]}"));

        assertThatThrownBy(() -> generator.generate("deepseek", "deepseek-chat", "Build app"))
                .isInstanceOf(ProjectCodeGenerator.ProjectCodeGenerationException.class)
                .hasMessageContaining("path");
    }

    private static LlmResponse response(String content) {
        return new LlmResponse(
                "deepseek",
                "deepseek-chat",
                content,
                new LlmUsage(null, null, null),
                null,
                "stop");
    }
}
