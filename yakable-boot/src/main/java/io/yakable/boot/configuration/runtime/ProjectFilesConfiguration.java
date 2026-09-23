package io.yakable.boot.configuration.runtime;

import io.yakable.core.project.files.ProjectFiles;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.nio.file.Path;

/**
 * Project 文件 Runtime 装配。
 */
@Configuration
public class ProjectFilesConfiguration {

    @Bean
    public ProjectFiles projectFiles(@Value("${yakable.project.files-root}") String root) {
        return new ProjectFiles(Path.of(root));
    }
}
