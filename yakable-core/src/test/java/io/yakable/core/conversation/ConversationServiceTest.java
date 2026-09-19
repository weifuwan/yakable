package io.yakable.core.conversation;

import io.yakable.core.llm.LlmMessage;
import io.yakable.core.llm.LlmProvider;
import io.yakable.core.llm.LlmRequest;
import io.yakable.core.llm.LlmResponse;
import io.yakable.core.llm.LlmUsage;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ConversationServiceTest {

    @Test
    void sendsCompleteConversationHistoryToTheLlmProvider() {
        RecordingRepository repository = new RecordingRepository();
        RecordingLlmProvider provider = new RecordingLlmProvider();
        ConversationService service = new ConversationService(repository, provider);

        service.sendMessage(
                "project-1",
                "deepseek",
                "deepseek-flash",
                "First question"
        );
        service.sendMessage(
                "project-1",
                "deepseek",
                "deepseek-flash",
                "Second question"
        );

        LlmRequest secondRequest = provider.requests.get(1);

        assertThat(secondRequest.model()).isEqualTo("deepseek-flash");
        assertThat(secondRequest.messages())
                .extracting(LlmMessage::role, LlmMessage::content)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple(
                                LlmMessage.Role.USER,
                                "First question"
                        ),
                        org.assertj.core.groups.Tuple.tuple(
                                LlmMessage.Role.ASSISTANT,
                                "Assistant 1"
                        ),
                        org.assertj.core.groups.Tuple.tuple(
                                LlmMessage.Role.USER,
                                "Second question"
                        )
                );

        assertThat(service.listMessages("project-1"))
                .extracting(ConversationMessage::role, ConversationMessage::content)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple(
                                ConversationMessage.Role.USER,
                                "First question"
                        ),
                        org.assertj.core.groups.Tuple.tuple(
                                ConversationMessage.Role.ASSISTANT,
                                "Assistant 1"
                        ),
                        org.assertj.core.groups.Tuple.tuple(
                                ConversationMessage.Role.USER,
                                "Second question"
                        ),
                        org.assertj.core.groups.Tuple.tuple(
                                ConversationMessage.Role.ASSISTANT,
                                "Assistant 2"
                        )
                );
    }

    private static final class RecordingRepository
            implements ConversationMessageRepository {

        private final List<ConversationMessage> messages = new ArrayList<>();

        @Override
        public ConversationMessage save(ConversationMessage message) {
            messages.add(message);
            return message;
        }

        @Override
        public List<ConversationMessage> findByProjectId(String projectId) {
            return messages.stream()
                    .filter(message -> message.projectId().equals(projectId))
                    .toList();
        }
    }

    private static final class RecordingLlmProvider implements LlmProvider {

        private final List<LlmRequest> requests = new ArrayList<>();

        @Override
        public String provider() {
            return "deepseek";
        }

        @Override
        public LlmResponse chat(LlmRequest request) {
            requests.add(request);
            return new LlmResponse(
                    "Assistant " + requests.size(),
                    new LlmUsage(null, null, null)
            );
        }
    }
}
