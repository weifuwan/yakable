package io.yakable.boot.conversation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.yakable.core.llm.LlmProvider;
import io.yakable.core.llm.LlmResponse;
import io.yakable.core.llm.LlmUsage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class ConversationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private LlmProvider llmProvider;

    @BeforeEach
    void setUpLlmProvider() {
        when(llmProvider.provider()).thenReturn("deepseek");
        when(llmProvider.chat(any())).thenReturn(
                new LlmResponse(
                        "I am Yakable.",
                        new LlmUsage(8L, 4L, 12L)
                )
        );
    }

    @Test
    void emptyConversationBecomesACompleteTurnAfterSendingTheInitialPrompt() throws Exception {
        String projectId = createProject("Who are you?");

        mockMvc.perform(get("/api/projects/{projectId}/messages", projectId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        mockMvc.perform(post("/api/projects/{projectId}/messages", projectId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "content": "Who are you?"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userMessage.role").value("USER"))
                .andExpect(jsonPath("$.userMessage.content").value("Who are you?"))
                .andExpect(jsonPath("$.assistantMessage.role").value("ASSISTANT"))
                .andExpect(jsonPath("$.assistantMessage.content").value("I am Yakable."));

        mockMvc.perform(get("/api/projects/{projectId}/messages", projectId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].role").value("USER"))
                .andExpect(jsonPath("$[0].content").value("Who are you?"))
                .andExpect(jsonPath("$[1].role").value("ASSISTANT"))
                .andExpect(jsonPath("$[1].content").value("I am Yakable."));
    }

    @Test
    void appendsUserAndAssistantMessagesForEachTurn() throws Exception {
        String projectId = createProject("First question");

        sendMessage(projectId, "First question");
        sendMessage(projectId, "Second question");

        mockMvc.perform(get("/api/projects/{projectId}/messages", projectId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].content").value("First question"))
                .andExpect(jsonPath("$[1].role").value("ASSISTANT"))
                .andExpect(jsonPath("$[2].content").value("Second question"))
                .andExpect(jsonPath("$[3].role").value("ASSISTANT"));
    }

    @Test
    void rejectsBlankMessage() throws Exception {
        String projectId = createProject("First question");

        mockMvc.perform(post("/api/projects/{projectId}/messages", projectId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "content": "   "
                                }
                                """))
                .andExpect(status().isBadRequest());
    }

    private void sendMessage(String projectId, String content) throws Exception {
        mockMvc.perform(post("/api/projects/{projectId}/messages", projectId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "content": "%s"
                                }
                                """.formatted(content)))
                .andExpect(status().isCreated());
    }

    private String createProject(String prompt) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/projects")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "prompt": "%s",
                                  "model": {
                                    "provider": "deepseek",
                                    "model": "deepseek-flash"
                                  }
                                }
                                """.formatted(prompt)))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode project = objectMapper.readTree(result.getResponse().getContentAsString());
        return project.get("id").asText();
    }
}
