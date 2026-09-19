package io.yakable.boot.configuration;

import io.yakable.boot.configuration.properties.ModelProperties;
import io.yakable.service.model.ModelClient;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(ModelProperties.class)
public class ModelConfiguration {

    @Bean
    ModelClient modelClient(ModelProperties properties) {
        return new ModelClient(properties::resolve);
    }
}
