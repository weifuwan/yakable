package io.yakable.core.conversation;

import io.yakable.core.model.ModelPluginRegistry;
import io.yakable.core.model.ModelRuntime;
import io.yakable.plugin.model.api.LlmMessage;
import io.yakable.plugin.model.api.LlmRequest;
import io.yakable.plugin.model.api.LlmResponse;
import io.yakable.plugin.model.api.LlmUsage;
import io.yakable.plugin.model.api.ModelCapability;
import io.yakable.plugin.model.api.ModelPlugin;
import io.yakable.plugin.model.api.ModelPluginConfiguration;
import io.yakable.plugin.model.api.ModelPluginDescriptor;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class ConversationServiceTest {

    @Test
    void sendsCompleteConversationHistoryThroughTheModelRuntime() {
        RecordingRepository repository = new RecordingRepository();
        RecordingModelPlugin plugin = new RecordingModelPlugin();
        ModelRuntime runtime = new ModelRuntime(
                ModelPluginRegistry.from(List.of(plugin)),
                provider -> new ModelPluginConfiguration("test-key", "https://example.test")
        );
        ConversationService service = new ConversationService(repository, runtime);

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

        LlmRequest secondRequest = plugin.requests.get(1);

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

    private static final class RecordingModelPlugin implements ModelPlugin {

        private static final ModelPluginDescriptor DESCRIPTOR =
                new ModelPluginDescriptor(
                        "deepseek",
                        "DeepSeek",
                        ModelPluginDescriptor.CURRENT_API_VERSION,
                        Set.of(ModelCapability.CHAT)
                );

        private final List<LlmRequest> requests = new ArrayList<>();

        @Override
        public ModelPluginDescriptor descriptor() {
            return DESCRIPTOR;
        }

        @Override
        public LlmResponse chat(
                ModelPluginConfiguration configuration,
                LlmRequest request
        ) {
            requests.add(request);
            return new LlmResponse(
                    "Assistant " + requests.size(),
                    new LlmUsage(null, null, null)
            );
        }
    }
}
