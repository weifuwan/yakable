package io.yakable.common.utils;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

/**
 * 线程和线程池工具。
 */
public final class ThreadUtils {

    private static final System.Logger log = System.getLogger(ThreadUtils.class.getName());

    private static final ExecutorService executor = Executors.newThreadPerTaskExecutor(
            Thread.ofVirtual().name("yakable-task-", 0).factory());

    private static final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(
            Thread.ofPlatform().daemon(true).name("yakable-scheduler-", 0).factory());

    private static final Map<String, Thread> runningTasks = new ConcurrentHashMap<>();
    private static final Map<String, ScheduledFuture<?>> scheduledTasks = new ConcurrentHashMap<>();

    private ThreadUtils() {
    }

    /**
     * 使用统一虚拟线程执行异步任务。
     *
     * @return 是否成功提交任务
     */
    public static boolean execute(String taskName, Runnable task) {
        try {
            executor.execute(() -> {
                Thread current = Thread.currentThread();
                runningTasks.put(taskName, current);
                try {
                    task.run();
                } catch (RuntimeException exception) {
                    log.log(System.Logger.Level.WARNING, "Task execution failed: " + taskName, exception);
                } finally {
                    runningTasks.remove(taskName, current);
                }
            });
            return true;
        } catch (RuntimeException exception) {
            log.log(System.Logger.Level.WARNING, "Failed to submit task: " + taskName, exception);
            return false;
        }
    }

    /**
     * 中断指定异步任务。
     */
    public static void cancel(String taskName) {
        Thread task = runningTasks.get(taskName);
        if (task != null) {
            task.interrupt();
        }
    }

    /**
     * 使用统一调度线程池按固定间隔执行任务。
     */
    public static void scheduleWithFixedDelay(String taskName, Runnable task, Duration interval) {
        long delayMillis = Math.max(1L, interval.toMillis());
        scheduledTasks.compute(taskName, (name, current) -> {
            if (current != null && !current.isCancelled() && !current.isDone()) {
                return current;
            }
            return scheduler.scheduleWithFixedDelay(
                    safeTask(taskName, task), 0L, delayMillis, TimeUnit.MILLISECONDS);
        });
    }

    /**
     * 取消指定定时任务。
     */
    public static void cancelScheduled(String taskName) {
        ScheduledFuture<?> task = scheduledTasks.remove(taskName);
        if (task != null) {
            task.cancel(false);
        }
    }

    private static Runnable safeTask(String taskName, Runnable task) {
        return () -> {
            try {
                task.run();
            } catch (RuntimeException exception) {
                log.log(System.Logger.Level.WARNING, "Task execution failed: " + taskName, exception);
            }
        };
    }
}
