package io.yakable.service.observability;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.yakable.common.enums.session.TurnStatusEnum;
import io.yakable.dao.repository.TurnRepository;
import org.springframework.stereotype.Component;

import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Conversation 运行指标。
 *
 * <p>指标标签只使用低基数维度，用户、Project、Session、Turn 等业务 ID 只进入日志，不进入 Metrics 标签。</p>
 */
@Component
public class ConversationMetrics {

    private static final Set<String> KNOWN_PROVIDERS = Set.of("deepseek");

    private final MeterRegistry meterRegistry;
    private final AtomicInteger activeExecutions = new AtomicInteger();
    private final AtomicInteger activeWatchers = new AtomicInteger();

    public ConversationMetrics(MeterRegistry meterRegistry, TurnRepository turnRepository) {
        this.meterRegistry = meterRegistry;
        Gauge.builder("yakable.turn.execution.active", activeExecutions, AtomicInteger::get)
                .description("Currently executing Turn tasks")
                .register(meterRegistry);
        Gauge.builder("yakable.sse.watchers.active", activeWatchers, AtomicInteger::get)
                .description("Currently active Turn stream watchers")
                .register(meterRegistry);
        Gauge.builder(
                        "yakable.turn.persisted",
                        turnRepository,
                        repository -> repository.queryTurnCount(TurnStatusEnum.PENDING))
                .description("Persisted Turns by non-terminal status")
                .tag("status", "pending")
                .register(meterRegistry);
        Gauge.builder(
                        "yakable.turn.persisted",
                        turnRepository,
                        repository -> repository.queryTurnCount(TurnStatusEnum.RUNNING))
                .description("Persisted Turns by non-terminal status")
                .tag("status", "running")
                .register(meterRegistry);
    }

    public void executionStarted() {
        activeExecutions.incrementAndGet();
    }

    public void executionFinished() {
        activeExecutions.decrementAndGet();
    }

    public void watcherConnected() {
        activeWatchers.incrementAndGet();
        meterRegistry.counter("yakable.sse.watcher.connections").increment();
    }

    public void watcherDisconnected() {
        activeWatchers.decrementAndGet();
    }

    public void executionDeferred(String reason) {
        meterRegistry.counter("yakable.turn.execution.deferred", "reason", reason).increment();
    }

    public void turnTerminal(String status) {
        meterRegistry.counter("yakable.turn.terminal", "status", status).increment();
    }

    public void recovered(String source, long count) {
        if (count > 0) {
            meterRegistry.counter("yakable.turn.recovery", "source", source).increment(count);
        }
    }

    public void idempotencyReplay(String type) {
        meterRegistry.counter("yakable.idempotency.replay", "type", type).increment();
    }

    public void contextTooLarge() {
        meterRegistry.counter("yakable.context.too_large").increment();
    }

    public void messageTooLarge() {
        meterRegistry.counter("yakable.message.size.rejected").increment();
    }

    public Timer.Sample startLlmCall() {
        return Timer.start(meterRegistry);
    }

    public void finishLlmCall(Timer.Sample sample, String provider, String outcome) {
        sample.stop(Timer.builder("yakable.llm.duration")
                .description("LLM provider call duration")
                .tag("provider", metricProvider(provider))
                .tag("outcome", outcome)
                .register(meterRegistry));
    }

    private static String metricProvider(String provider) {
        return KNOWN_PROVIDERS.contains(provider) ? provider : "other";
    }
}
