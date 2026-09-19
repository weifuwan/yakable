package io.yakable.plugin.model.all;

import io.yakable.plugin.model.api.ModelPlugin;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.ServiceLoader;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class AllModelPluginsTest {

    @Test
    void discoversDeepSeekPluginThroughAutoServiceAndServiceLoader() {
        Set<String> discovered = new HashSet<>();

        ServiceLoader.load(ModelPlugin.class)
                .forEach(plugin -> discovered.add(plugin.provider()));

        assertThat(discovered).contains("deepseek");
    }
}
