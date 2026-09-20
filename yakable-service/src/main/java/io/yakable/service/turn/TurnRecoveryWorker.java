package io.yakable.service.turn;

import io.yakable.common.utils.DateUtils;
import io.yakable.common.utils.ThreadUtils;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.annotation.Resource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

@Component
public class TurnRecoveryWorker {

    private static final System.Logger log = System.getLogger(TurnRecoveryWorker.class.getName());

    private final ScheduledExecutorService scheduler = ThreadUtils.newSingleScheduledExecutor("yakable-turn-recovery-");

    @Resource
    private TurnService turnService;

    @Resource
    private TurnDispatcher dispatcher;

    @Value("${yakable.turn-execution.recovery-enabled:true}")
    private boolean enabled;

    @Value("${yakable.turn-execution.recovery-interval:5s}")
    private Duration interval;

    @Value("${yakable.turn-execution.running-timeout:10m}")
    private Duration runningTimeout;

    @Value("${yakable.turn-execution.recovery-batch-size:100}")
    private int batchSize;

    private ScheduledFuture<?> task;

    @PostConstruct
    void start() {
        if (!enabled) {
            return;
        }
        task = scheduler.scheduleWithFixedDelay(
                this::runSafely, 0L, Math.max(1L, interval.toMillis()), TimeUnit.MILLISECONDS);
    }

    public void runOnce() {
        LocalDateTime now = DateUtils.now();
        int recovered = turnService.updateStaleTurnPending(now.minus(runningTimeout));
        turnService.queryPendingTurnIdList(batchSize).forEach(dispatcher::dispatch);

        if (recovered > 0) {
            log.log(System.Logger.Level.WARNING, "Recovered stale RUNNING turns: " + recovered);
        }
    }

    private void runSafely() {
        try {
            runOnce();
        } catch (RuntimeException exception) {
            log.log(System.Logger.Level.WARNING, "Turn recovery cycle failed", exception);
        }
    }

    @PreDestroy
    void close() {
        if (task != null) {
            task.cancel(false);
        }
        scheduler.close();
    }
}
