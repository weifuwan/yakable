package io.yakable.boot.configuration.runtime;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

/**
 * SaaS V1 运行边界。
 */
@Configuration
public class RuntimeBoundaryConfiguration {

    static final String SINGLE_INSTANCE = "single-instance";

    @Value("${yakable.runtime.mode:single-instance}")
    private String runtimeMode;

    @PostConstruct
    void validateRuntimeMode() {
        if (!SINGLE_INSTANCE.equalsIgnoreCase(runtimeMode == null ? "" : runtimeMode.strip())) {
            throw new IllegalStateException(
                    "Yakable SaaS V1 only supports runtime mode: " + SINGLE_INSTANCE);
        }
    }
}
