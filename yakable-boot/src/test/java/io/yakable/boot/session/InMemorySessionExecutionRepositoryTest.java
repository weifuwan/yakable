package io.yakable.boot.session;

import io.yakable.core.session.SessionBusyException;
import io.yakable.core.session.SessionMessage;
import io.yakable.core.session.Turn;
import io.yakable.core.session.TurnStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;

class InMemorySessionExecutionRepositoryTest {

    @Test
    void concurrentTurnCreationAllowsOnlyOneActiveTurn() throws Exception {
        InMemorySessionExecutionRepository repository =
                new InMemorySessionExecutionRepository();

        int workers = 24;
        CountDownLatch ready = new CountDownLatch(workers);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Boolean>> futures = new ArrayList<>();

        try (ExecutorService executor = Executors.newFixedThreadPool(workers)) {
            for (int index = 0; index < workers; index++) {
                int worker = index;
                futures.add(executor.submit(() -> {
                    ready.countDown();
                    start.await();

                    Instant now = Instant.now();
                    Turn turn = new Turn(
                            UUID.randomUUID().toString(),
                            "session-1",
                            TurnStatus.PENDING,
                            null,
                            now,
                            now
                    );

                    try {
                        repository.createPendingTurn(
                                turn,
                                UUID.randomUUID().toString(),
                                "message-" + worker,
                                now
                        );
                        return true;
                    } catch (SessionBusyException exception) {
                        return false;
                    }
                }));
            }

            ready.await();
            start.countDown();

            long successes = 0;
            for (Future<Boolean> future : futures) {
                if (future.get()) {
                    successes++;
                }
            }

            assertThat(successes).isEqualTo(1);
            assertThat(repository.findTurnsBySessionId("session-1"))
                    .hasSize(1);
            assertThat(repository.findMessagesBySessionId("session-1"))
                    .extracting(SessionMessage::sequence)
                    .containsExactly(1L);
        }
    }

    @Test
    void concurrentClaimAllowsOnlyOneExecutor() throws Exception {
        InMemorySessionExecutionRepository repository =
                new InMemorySessionExecutionRepository();

        Instant now = Instant.now();
        Turn turn = new Turn(
                "turn-1",
                "session-1",
                TurnStatus.PENDING,
                null,
                now,
                now
        );
        repository.createPendingTurn(
                turn,
                "message-1",
                "hello",
                now
        );

        int workers = 24;
        CountDownLatch ready = new CountDownLatch(workers);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Boolean>> futures = new ArrayList<>();

        try (ExecutorService executor = Executors.newFixedThreadPool(workers)) {
            for (int index = 0; index < workers; index++) {
                futures.add(executor.submit(() -> {
                    ready.countDown();
                    start.await();
                    return repository
                            .claimPendingTurn(
                                    turn.id(),
                                    Instant.now()
                            )
                            .isPresent();
                }));
            }

            ready.await();
            start.countDown();

            long claims = 0;
            for (Future<Boolean> future : futures) {
                if (future.get()) {
                    claims++;
                }
            }

            assertThat(claims).isEqualTo(1);
            assertThat(repository.findTurnById(turn.id()))
                    .get()
                    .extracting(Turn::status)
                    .isEqualTo(TurnStatus.RUNNING);
        }
    }

    @Test
    void completionPersistsAssistantMessageAndSucceededStateTogether() {
        InMemorySessionExecutionRepository repository =
                new InMemorySessionExecutionRepository();

        Instant now = Instant.now();
        Turn pending = new Turn(
                "turn-1",
                "session-1",
                TurnStatus.PENDING,
                null,
                now,
                now
        );
        repository.createPendingTurn(
                pending,
                "message-1",
                "hello",
                now
        );

        Turn running = repository
                .claimPendingTurn("turn-1", now)
                .orElseThrow();

        repository.completeTurn(
                running,
                "message-2",
                "world",
                now.plusSeconds(1)
        );

        assertThat(repository.findTurnById("turn-1"))
                .get()
                .extracting(Turn::status)
                .isEqualTo(TurnStatus.SUCCEEDED);

        assertThat(repository.findMessagesBySessionId("session-1"))
                .extracting(
                        SessionMessage::role,
                        SessionMessage::sequence
                )
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple(
                                SessionMessage.Role.USER,
                                1L
                        ),
                        org.assertj.core.groups.Tuple.tuple(
                                SessionMessage.Role.ASSISTANT,
                                2L
                        )
                );
    }

}