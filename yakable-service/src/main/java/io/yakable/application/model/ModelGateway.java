package io.yakable.application.model;

@FunctionalInterface
public interface ModelGateway {

    ModelReply chat(String provider, ModelRequest request);
}
