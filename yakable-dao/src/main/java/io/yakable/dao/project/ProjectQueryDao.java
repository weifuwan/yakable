package io.yakable.dao.project;

import io.yakable.dao.project.model.ProjectQueryRow;

import java.util.List;
import java.util.Optional;

public interface ProjectQueryDao {

    long countProjects();

    List<ProjectQueryRow> findProjectPage(
            long offset,
            int limit
    );

    Optional<ProjectQueryRow> findProjectDetails(
            String projectId
    );
}
