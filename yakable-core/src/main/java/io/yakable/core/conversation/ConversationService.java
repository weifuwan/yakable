package io.yakable.core.conversation;

import io.yakable.core.model.ModelRuntime;
import io.yakable.plugin.model.api.LlmMessage;
import io.yakable.plugin.model.api.LlmRequest;
import io.yakable.plugin.model.api.LlmResponse;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

public final class ConversationService {

    private static final String SYSTEM_PROMPT =
            "You are Yakable, a concise and accurate assistant.";

    private final ConversationMessageRepository messageRepository;
    private final ModelRuntime modelRuntime;

    public ConversationService(
            ConversationMessageRepository messageRepository,
            ModelRuntime modelRuntime
    ) {
        this.messageRepository = Objects.requireNonNull(messageRepository, "messageRepository");
        this.modelRuntime = Objects.requireNonNull(modelRuntime, "modelRuntime");
    }

    public List<ConversationMessage> listMessages(String projectId) {
        Objects.requireNonNull(projectId, "projectId");
        return messageRepository.findByProjectId(projectId);
    }

    public ConversationTurn sendMessage(
            String projectId,
            String provider,
            String model,
            String content
    ) {
        String normalizedProvider = requireText(provider, "provider");
        String normalizedModel = requireText(model, "model");

        ConversationMessage userMessage = appendUserMessage(projectId, content);

        List<LlmMessage> history = listMessages(projectId).stream()
                .map(ConversationService::toLlmMessage)
                .toList();

        LlmResponse response = modelRuntime.chat(
                normalizedProvider,
                new LlmRequest(normalizedModel, SYSTEM_PROMPT, history)
        );

        ConversationMessage assistantMessage =
                appendAssistantMessage(projectId, response.content());

        return new ConversationTurn(userMessage, assistantMessage);
    }

    public ConversationMessage appendUserMessage(String projectId, String content) {
        return appendMessage(projectId, ConversationMessage.Role.USER, content);
    }

    public ConversationMessage appendAssistantMessage(String projectId, String content) {
        return appendMessage(projectId, ConversationMessage.Role.ASSISTANT, content);
    }

    private ConversationMessage appendMessage(
            String projectId,
            ConversationMessage.Role role,
            String content
    ) {
        ConversationMessage message = new ConversationMessage(
                UUID.randomUUID().toString(),
                projectId,
                role,
                content,
                Instant.now()
        );

        return messageRepository.save(message);
    }

    private static LlmMessage toLlmMessage(ConversationMessage message) {
        LlmMessage.Role role = switch (message.role()) {
            case USER -> LlmMessage.Role.USER;
            case ASSISTANT -> LlmMessage.Role.ASSISTANT;
        };

        return new LlmMessage(role, message.content());
    }

    private static String requireText(String value, String field) {
        Objects.requireNonNull(value, field);
        String normalized = value.strip();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return normalized;
    }
}
