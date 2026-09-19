package io.yakable.application.model;

import java.util.Objects;

public record ModelReply(String content) {

    public ModelReply {
        Objects.requireNonNull(content, "content");
    }
}
