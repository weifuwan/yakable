package io.yakable.boot.configuration.swagger;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Swagger / OpenAPI 配置。
 */
@Configuration(proxyBeanMethods = false)
public class SwaggerConfiguration {

    @Bean
    OpenAPI yakableOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("Yakable API")
                        .version("v1")
                        .description("Yakable HTTP API"));
    }

    @Bean
    GroupedOpenApi yakableApi() {
        return GroupedOpenApi.builder()
                .group("yakable")
                .pathsToMatch("/api/**")
                .build();
    }
}
