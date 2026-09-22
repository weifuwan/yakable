package io.yakable.common.constant;

/**
 * Message 持久化边界。
 */
public final class MessageConstant {

    /**
     * 单条 Message 最大字符数。
     *
     * <p>该值显著低于 MySQL MEDIUMTEXT 的字节上限，并为 UTF-8 多字节字符保留空间。</p>
     */
    public static final int MAX_CONTENT_LENGTH = 2_000_000;

    private MessageConstant() {
    }
}
