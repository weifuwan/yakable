package io.yakable.common.utils;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ThreadFactory;

/**
 * 线程和线程池工具。
 */
public final class ThreadUtils {

    private ThreadUtils() {
    }

    /**
     * 创建按任务启动虚拟线程的 Executor。
     */
    public static ExecutorService newVirtualThreadExecutor(String namePrefix) {
        ThreadFactory factory = Thread.ofVirtual().name(namePrefix, 0).factory();
        return Executors.newThreadPerTaskExecutor(factory);
    }

    /**
     * 创建单线程定时调度 Executor。
     */
    public static ScheduledExecutorService newSingleScheduledExecutor(String namePrefix) {
        ThreadFactory factory = Thread.ofPlatform().name(namePrefix, 0).factory();
        return Executors.newSingleThreadScheduledExecutor(factory);
    }
}
