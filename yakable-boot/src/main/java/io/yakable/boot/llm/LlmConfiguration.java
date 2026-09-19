package io.yakable.boot.llm;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.yakable.core.llm.LlmProvider;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(DeepSeekProperties.class)
public class LlmConfiguration {

    @Bean
    LlmProvider llmProvider(
            DeepSeekProperties properties,
            ObjectMapper objectMapper
    ) {
        return new DeepSeekLlmProvider(properties, objectMapper);
    }
}
