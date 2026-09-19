package io.yakable.boot.generation;

import io.yakable.core.generation.GenerationRunRepository;
import io.yakable.core.generation.GenerationService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class GenerationConfiguration {

    @Bean
    GenerationRunRepository generationRunRepository() {
        return new InMemoryGenerationRunRepository();
    }

    @Bean
    GenerationService generationService(GenerationRunRepository generationRunRepository) {
        return new GenerationService(generationRunRepository);
    }
}
