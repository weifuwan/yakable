package io.yakable.boot.conversation;

import io.yakable.core.conversation.ConversationMessage;
import io.yakable.core.conversation.ConversationMessageRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.CopyOnWriteArrayList;

final class InMemoryConversationMessageRepository implements ConversationMessageRepository {

    private final ConcurrentMap<String, CopyOnWriteArrayList<ConversationMessage>> messagesByProject =
            new ConcurrentHashMap<>();

    @Override
    public ConversationMessage save(ConversationMessage message) {
        messagesByProject
                .computeIfAbsent(message.projectId(), ignored -> new CopyOnWriteArrayList<>())
                .add(message);
        return message;
    }

    @Override
    public List<ConversationMessage> findByProjectId(String projectId) {
        return new ArrayList<>(messagesByProject.getOrDefault(
                projectId,
                new CopyOnWriteArrayList<>()
        ));
    }
}
