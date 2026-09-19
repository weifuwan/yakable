package io.yakable.core.conversation;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

public final class ConversationService {

    private final ConversationMessageRepository messageRepository;

    public ConversationService(ConversationMessageRepository messageRepository) {
        this.messageRepository = Objects.requireNonNull(messageRepository, "messageRepository");
    }

    public List<ConversationMessage> listMessages(String projectId) {
        Objects.requireNonNull(projectId, "projectId");
        return messageRepository.findByProjectId(projectId);
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
}
