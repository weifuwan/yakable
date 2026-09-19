package io.yakable.core.project;

import io.yakable.core.session.Session;
import io.yakable.core.session.TurnStartResult;

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
