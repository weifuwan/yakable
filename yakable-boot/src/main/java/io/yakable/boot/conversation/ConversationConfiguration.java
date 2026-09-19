package io.yakable.boot.conversation;

import io.yakable.core.conversation.ConversationMessageRepository;
import io.yakable.core.conversation.ConversationService;
import io.yakable.core.model.ModelRuntime;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class ConversationConfiguration {

    @Bean
    ConversationMessageRepository conversationMessageRepository() {
        return new InMemoryConversationMessageRepository();
    }

    @Bean
    ConversationService conversationService(
            ConversationMessageRepository messageRepository,
            ModelRuntime modelRuntime
    ) {
        return new ConversationService(messageRepository, modelRuntime);
    }
}
