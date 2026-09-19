package io.yakable.application.project;

import io.yakable.domain.project.Project;
import io.yakable.domain.session.Session;
import io.yakable.domain.session.TurnStartResult;

import java.util.Objects;

public record ProjectStartResult(
        Project project,
        Session session,
        TurnStartResult initialTurn
) {

    public ProjectStartResult {
        Objects.requireNonNull(project, "project");
        Objects.requireNonNull(session, "session");
        Objects.requireNonNull(initialTurn, "initialTurn");
    }
}
