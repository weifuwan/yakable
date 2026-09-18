package io.yakable.core.project;

import java.util.List;
import java.util.Optional;

public interface ProjectRepository {

    Project save(Project project);

    Optional<Project> findById(String projectId);

    List<Project> findAll();
}
