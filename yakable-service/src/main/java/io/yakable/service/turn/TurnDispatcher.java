package io.yakable.service.turn;

import io.yakable.common.utils.ThreadUtils;
import jakarta.annotation.PreDestroy;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Component;

import java.util.concurrent.ExecutorService;

@Component
public class TurnDispatcher {

    private static final System.Logger log = System.getLogger(TurnDispatcher.class.getName());

    private final ExecutorService executor = ThreadUtils.newVirtualThreadExecutor("yakable-turn-");

    @Resource
    private TurnExecutor turnExecutor;

    public boolean dispatch(String turnId) {
        try {
            executor.execute(() -> executeSafely(turnId));
            return true;
        } catch (RuntimeException exception) {
            log.log(System.Logger.Level.WARNING, "Turn dispatch rejected: " + turnId, exception);
            return false;
        }
    }

    private void executeSafely(String turnId) {
        try {
            turnExecutor.execute(turnId);
        } catch (RuntimeException exception) {
            log.log(System.Logger.Level.WARNING, "Turn execution failed: " + turnId, exception);
        }
    }

    @PreDestroy
    void close() {
        executor.close();
    }
}
