package io.yakable.common.utils;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.experimental.UtilityClass;

/**
 * JSON 公共处理工具。
 */
@UtilityClass
public class JsonUtils {

    private final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    /**
     * 序列化对象为 JSON。
     */
    public String toJson(Object value) {
        try {
            return OBJECT_MAPPER.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Unable to serialize JSON.", exception);
        }
    }

    /**
     * 解析 JSON 为节点树。
     */
    public JsonNode parseTree(String value) {
        try {
            return OBJECT_MAPPER.readTree(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Invalid JSON.", exception);
        }
    }

    /**
     * 读取可选文本值。
     */
    public String textValue(JsonNode node) {
        return node != null && node.isTextual() ? StringUtils.stripToNull(node.asText()) : null;
    }

    /**
     * 读取可选 Long 值。
     */
    public Long longValue(JsonNode node) {
        return node != null && node.isNumber() ? node.longValue() : null;
    }
}
