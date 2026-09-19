package io.yakable.domain.project.repository;

import io.yakable.domain.project.Project;

import java.util.Optional;

public interface ProjectRepository {

    Project save(Project project);

    Optional<Project> findById(String projectId);
}
