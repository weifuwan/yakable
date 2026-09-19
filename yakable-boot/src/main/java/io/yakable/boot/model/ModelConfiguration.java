package io.yakable.boot.model;

import io.yakable.core.model.ModelPluginConfigurationResolver;
import io.yakable.core.model.ModelPluginRegistry;
import io.yakable.core.model.ModelRuntime;
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
    ModelRuntime modelRuntime(
            ModelPluginRegistry registry,
            ModelPluginConfigurationResolver configurationResolver
    ) {
        return new ModelRuntime(registry, configurationResolver);
    }
}
