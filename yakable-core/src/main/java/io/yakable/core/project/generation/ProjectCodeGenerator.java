package io.yakable.core.project.generation;

import com.fasterxml.jackson.databind.JsonNode;
import io.yakable.common.utils.JsonUtils;
import io.yakable.core.llm.LlmClient;
import io.yakable.core.llm.LlmMessage;
import io.yakable.core.llm.LlmRequest;
import io.yakable.core.llm.LlmResponse;
import io.yakable.core.project.files.ProjectFile;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * 根据用户 Prompt 生成结构化 Project 代码。
 *
 * <p>只负责 LLM 请求和 Generation Result 解析，不负责 Project 文件发布或 Turn 状态。</p>
 */
@Component
public class ProjectCodeGenerator {

    private static final String SYSTEM_PROMPT = """
            You are Yakable's project code generator.
            Return exactly one valid JSON object and nothing else.
            The JSON schema is:
            {"summary":"short user-visible summary","files":[{"path":"relative/file/path","content":"complete file content"}]}
            Rules:
            - Generate a complete project from the user's request.
            - Include every file required by the chosen implementation.
            - files must contain at least one file.
            - Every path must be relative to the project root.
            - Every content value must contain the complete file content, not a patch or diff.
            - Keep summary concise and useful to the user.
            - Do not use Markdown code fences.
            - Do not add prose before or after the JSON object.
            """;

    private final LlmClient llmClient;

    public ProjectCodeGenerator(LlmClient llmClient) {
        this.llmClient = Objects.requireNonNull(llmClient, "llmClient");
    }

    /**
     * 调用指定模型生成完整 Project 结构。
     */
    public ProjectCodeGenerationResult generate(String provider, String model, String prompt) {
        LlmRequest request = new LlmRequest(
                provider,
                model,
                SYSTEM_PROMPT,
                List.of(new LlmMessage(LlmMessage.Role.USER, prompt)));
        LlmResponse response = Objects.requireNonNull(llmClient.chat(request), "response");
        GeneratedProject project = parse(response.content());
        return new ProjectCodeGenerationResult(
                project,
                response.usage(),
                response.providerRequestId(),
                response.finishReason());
    }

    private GeneratedProject parse(String content) {
        try {
            JsonNode root = JsonUtils.parseTreeStrict(content);
            if (root == null || !root.isObject()) {
                throw invalid("Generation Result must be a JSON object");
            }

            String summary = JsonUtils.textValue(root.get("summary"));
            if (summary == null) {
                throw invalid("Generation Result summary must be non-blank text");
            }

            JsonNode filesNode = root.get("files");
            if (filesNode == null || !filesNode.isArray() || filesNode.size() == 0) {
                throw invalid("Generation Result files must be a non-empty array");
            }

            List<ProjectFile> files = new ArrayList<>(filesNode.size());
            for (JsonNode fileNode : filesNode) {
                files.add(parseFile(fileNode));
            }
            return new GeneratedProject(summary, files);
        } catch (ProjectCodeGenerationException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw new ProjectCodeGenerationException("Invalid Project Code Generation Result", exception);
        }
    }

    private ProjectFile parseFile(JsonNode node) {
        if (node == null || !node.isObject()) {
            throw invalid("Generated file must be a JSON object");
        }
        String path = JsonUtils.textValue(node.get("path"));
        JsonNode contentNode = node.get("content");
        if (path == null) {
            throw invalid("Generated file path must be non-blank text");
        }
        if (contentNode == null || !contentNode.isTextual()) {
            throw invalid("Generated file content must be text: " + path);
        }
        return new ProjectFile(path, contentNode.asText());
    }

    private static ProjectCodeGenerationException invalid(String message) {
        return new ProjectCodeGenerationException(message);
    }

    public static final class ProjectCodeGenerationException extends RuntimeException {

        public ProjectCodeGenerationException(String message) {
            super(message);
        }

        public ProjectCodeGenerationException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
