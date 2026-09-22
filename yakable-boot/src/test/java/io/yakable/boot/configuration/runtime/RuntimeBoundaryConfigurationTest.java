package io.yakable.boot.configuration.runtime;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RuntimeBoundaryConfigurationTest {

    @Test
    void shouldAcceptSingleInstanceMode() {
        RuntimeBoundaryConfiguration configuration = new RuntimeBoundaryConfiguration();
        ReflectionTestUtils.setField(configuration, "runtimeMode", "single-instance");

        assertThatCode(configuration::validateRuntimeMode).doesNotThrowAnyException();
    }

    @Test
    void shouldRejectUnsupportedRuntimeMode() {
        RuntimeBoundaryConfiguration configuration = new RuntimeBoundaryConfiguration();
        ReflectionTestUtils.setField(configuration, "runtimeMode", "multi-instance");

        assertThatThrownBy(configuration::validateRuntimeMode)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("single-instance");
    }
}
