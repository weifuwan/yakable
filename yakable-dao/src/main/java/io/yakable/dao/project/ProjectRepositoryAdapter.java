package io.yakable.dao.project;

import io.yakable.dao.project.model.ProjectPO;
import io.yakable.domain.project.Project;
import io.yakable.domain.project.ProjectStatus;
import io.yakable.domain.project.repository.ProjectRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Repository
public class ProjectRepositoryAdapter
        implements ProjectRepository {

    private final ProjectDao dao;

    public ProjectRepositoryAdapter(ProjectDao dao) {
        this.dao = Objects.requireNonNull(dao, "dao");
    }

    @Override
    @Transactional
    public Project save(Project project) {
        dao.save(toPO(project));
        return project;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Project> findById(String projectId) {
        return dao.findById(projectId).map(
                ProjectRepositoryAdapter::toDomain
        );
    }

    @Override
    @Transactional(readOnly = true)
    public List<Project> findAll() {
        return dao.findAll().stream()
                .map(ProjectRepositoryAdapter::toDomain)
                .toList();
    }

    private static ProjectPO toPO(Project project) {
        ProjectPO po = new ProjectPO();
        po.setId(project.id());
        po.setName(project.name());
        po.setStatus(project.status().name());
        po.setCreatedAt(project.createdAt());
        po.setUpdatedAt(project.updatedAt());
        return po;
    }

    private static Project toDomain(ProjectPO po) {
        return new Project(
                po.getId(),
                po.getName(),
                ProjectStatus.valueOf(po.getStatus()),
                po.getCreatedAt(),
                po.getUpdatedAt()
        );
    }
}
