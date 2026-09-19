package io.yakable.core.llm;

public interface LlmProvider {

    String provider();

    LlmResponse chat(LlmRequest request);
}
