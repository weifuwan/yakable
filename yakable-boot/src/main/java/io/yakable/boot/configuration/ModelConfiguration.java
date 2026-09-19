package io.yakable.boot.configuration;

import io.yakable.application.model.ModelGateway;
import io.yakable.boot.configuration.properties.ModelProperties;
import io.yakable.infrastructure.model.ModelPluginConfigurationResolver;
import io.yakable.infrastructure.model.ModelPluginRegistry;
import io.yakable.infrastructure.model.PluginModelGateway;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(ModelProperties.class)
public class ModelConfiguration {

    @Bean
    ModelPluginRegistry modelPluginRegistry() {
        return ModelPluginRegistry.load();
    }

    @Bean
    ModelPluginConfigurationResolver modelPluginConfigurationResolver(
            ModelProperties properties
    ) {
        return properties::resolve;
    }

    @Bean
    ModelGateway modelGateway(
            ModelPluginRegistry registry,
            ModelPluginConfigurationResolver configurationResolver
    ) {
        return new PluginModelGateway(
                registry,
                configurationResolver
        );
    }
}
