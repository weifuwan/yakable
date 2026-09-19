package io.yakable.application.context;

import io.yakable.application.model.ModelMessage;
import io.yakable.application.model.ModelRequest;
import io.yakable.domain.session.Session;
import io.yakable.domain.session.SessionMessage;
import io.yakable.domain.session.SessionStatus;
import io.yakable.domain.session.Turn;
import io.yakable.domain.session.TurnInvocation;
import io.yakable.domain.session.TurnStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ContextHarnessTest {

    private static final Instant NOW =
            Instant.parse("2026-09-19T00:00:00Z");

    @Test
    void policyAdmitsSucceededHistoryAndCurrentTurnOnly() {
        Session session = session();

        Turn succeeded = pending("turn-1")
                .markRunning(
                        NOW.plusSeconds(1),
                        "deepseek",
                        "deepseek-flash"
                );
        TurnInvocation completedInvocation =
                succeeded.invocation().completed(
                        "deepseek",
                        "deepseek-flash",
                        null,
                        null,
                        "stop"
                );
        succeeded = succeeded.markSucceeded(
                NOW.plusSeconds(2),
                completedInvocation
        );

        Turn failed = pending("turn-2")
                .markRunning(
                        NOW.plusSeconds(3),
                        "deepseek",
                        "deepseek-flash"
                )
                .markFailed(
                        "failed",
                        NOW.plusSeconds(4)
                );

        Turn current = pending("turn-3")
                .markRunning(
                        NOW.plusSeconds(5),
                        "deepseek",
                        "deepseek-flash"
                );

        List<SessionMessage> messages = List.of(
                message(
                        "message-1",
                        "turn-1",
                        SessionMessage.Role.USER,
                        "first question",
                        1
                ),
                message(
                        "message-2",
                        "turn-1",
                        SessionMessage.Role.ASSISTANT,
                        "first answer",
                        2
                ),
                message(
                        "message-3",
                        "turn-2",
                        SessionMessage.Role.USER,
                        "failed question",
                        3
                ),
                message(
                        "message-4",
                        "turn-3",
                        SessionMessage.Role.USER,
                        "current question",
                        4
                )
        );

        ContextBundle context = new DefaultContextPolicy()
                .resolve(
                        session,
                        current,
                        List.of(succeeded, failed, current),
                        messages
                );

        assertThat(context.conversation())
                .extracting(SessionMessage::content)
                .containsExactly(
                        "first question",
                        "first answer",
                        "current question"
                );
    }

    @Test
    void compilerProducesModelRequestFromApprovedContext() {
        Session session = session();
        ContextBundle context = new ContextBundle(
                "System controlled instructions",
                List.of(
                        message(
                                "message-1",
                                "turn-1",
                                SessionMessage.Role.USER,
                                "hello",
                                1
                        ),
                        message(
                                "message-2",
                                "turn-1",
                                SessionMessage.Role.ASSISTANT,
                                "hi",
                                2
                        )
                )
        );

        ModelRequest request = new ModelInvocationCompiler()
                .compile(session, context);

        assertThat(request.model())
                .isEqualTo("deepseek-flash");
        assertThat(request.systemPrompt())
                .isEqualTo("System controlled instructions");
        assertThat(request.messages())
                .extracting(
                        ModelMessage::role,
                        ModelMessage::content
                )
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple(
                                ModelMessage.Role.USER,
                                "hello"
                        ),
                        org.assertj.core.groups.Tuple.tuple(
                                ModelMessage.Role.ASSISTANT,
                                "hi"
                        )
                );
    }

    private static Session session() {
        return new Session(
                "session-1",
                "project-1",
                "CRM",
                "deepseek",
                "deepseek-flash",
                SessionStatus.ACTIVE,
                NOW,
                NOW
        );
    }

    private static Turn pending(String id) {
        return new Turn(
                id,
                "session-1",
                TurnStatus.PENDING,
                0,
                null,
                null,
                null,
                null,
                NOW,
                NOW
        );
    }

    private static SessionMessage message(
            String id,
            String turnId,
            SessionMessage.Role role,
            String content,
            long sequence
    ) {
        return new SessionMessage(
                id,
                "session-1",
                turnId,
                role,
                content,
                sequence,
                NOW.plusSeconds(sequence)
        );
    }
}
