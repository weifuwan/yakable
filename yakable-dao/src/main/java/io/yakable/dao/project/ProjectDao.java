package io.yakable.dao.project;

import io.yakable.dao.project.model.ProjectPO;

import java.util.Optional;

public interface ProjectDao {

    ProjectPO save(ProjectPO project);

    Optional<ProjectPO> findById(String projectId);
}
