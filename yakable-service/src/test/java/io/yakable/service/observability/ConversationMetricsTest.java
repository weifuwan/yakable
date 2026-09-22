package io.yakable.service.observability;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import io.yakable.common.enums.session.TurnStatusEnum;
import io.yakable.dao.repository.TurnRepository;
import org.junit.jupiter.api.Test;


import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ConversationMetricsTest {

    @Test
    void shouldExposeBoundedConversationMetrics() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        TurnRepository turnRepository = mock(TurnRepository.class);
        when(turnRepository.queryTurnCount(TurnStatusEnum.PENDING)).thenReturn(3L);
        when(turnRepository.queryTurnCount(TurnStatusEnum.RUNNING)).thenReturn(2L);

        ConversationMetrics metrics = new ConversationMetrics(registry, turnRepository);

        metrics.executionStarted();
        metrics.watcherConnected();
        metrics.executionDeferred("global_limit");
        metrics.turnTerminal("failed");
        metrics.recovered("stale", 2);
        metrics.idempotencyReplay("turn");
        metrics.contextTooLarge();
        metrics.messageTooLarge();

        var llmSample = metrics.startLlmCall();
        metrics.finishLlmCall(llmSample, "deepseek", "success");

        assertThat(registry.get("yakable.turn.execution.active").gauge().value()).isEqualTo(1.0);
        assertThat(registry.get("yakable.sse.watchers.active").gauge().value()).isEqualTo(1.0);
        assertThat(registry.get("yakable.turn.persisted").tag("status", "pending").gauge().value()).isEqualTo(3.0);
        assertThat(registry.get("yakable.turn.persisted").tag("status", "running").gauge().value()).isEqualTo(2.0);
        assertThat(registry.get("yakable.turn.execution.deferred")
                .tag("reason", "global_limit").counter().count()).isEqualTo(1.0);
        assertThat(registry.get("yakable.turn.terminal").tag("status", "failed").counter().count()).isEqualTo(1.0);
        assertThat(registry.get("yakable.turn.recovery").tag("source", "stale").counter().count()).isEqualTo(2.0);
        assertThat(registry.get("yakable.idempotency.replay").tag("type", "turn").counter().count()).isEqualTo(1.0);
        assertThat(registry.get("yakable.context.too_large").counter().count()).isEqualTo(1.0);
        assertThat(registry.get("yakable.message.size.rejected").counter().count()).isEqualTo(1.0);
        assertThat(registry.get("yakable.llm.duration")
                .tag("provider", "deepseek")
                .tag("outcome", "success")
                .timer()
                .count()).isEqualTo(1L);

        metrics.executionFinished();
        metrics.watcherDisconnected();

        assertThat(registry.get("yakable.turn.execution.active").gauge().value()).isZero();
        assertThat(registry.get("yakable.sse.watchers.active").gauge().value()).isZero();
    }

    @Test
    void shouldCollapseUnknownProviderMetricLabels() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        TurnRepository turnRepository = mock(TurnRepository.class);
        ConversationMetrics metrics = new ConversationMetrics(registry, turnRepository);

        var sample = metrics.startLlmCall();
        metrics.finishLlmCall(sample, "user-controlled-provider", "failure");

        assertThat(registry.get("yakable.llm.duration")
                .tag("provider", "other")
                .tag("outcome", "failure")
                .timer()
                .count()).isEqualTo(1L);
    }
}
