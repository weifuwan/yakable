package io.yakable.core.conversation;

import java.util.List;

public interface ConversationMessageRepository {

    ConversationMessage save(ConversationMessage message);

    List<ConversationMessage> findByProjectId(String projectId);
}
