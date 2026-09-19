package io.yakable.boot.conversation;

import io.yakable.core.conversation.ConversationMessageRepository;
import io.yakable.core.conversation.ConversationService;
import io.yakable.core.llm.LlmProvider;
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
            LlmProvider llmProvider
    ) {
        return new ConversationService(messageRepository, llmProvider);
    }
}
