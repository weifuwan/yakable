package io.yakable.boot.conversation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

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

    @Test
    void initialProjectPromptIsTheFirstUserMessage() throws Exception {
        String projectId = createProject("Who are you?");

        mockMvc.perform(get("/api/projects/{projectId}/messages", projectId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].role").value("USER"))
                .andExpect(jsonPath("$[0].content").value("Who are you?"));
    }

    @Test
    void appendsAndReloadsUserMessages() throws Exception {
        String projectId = createProject("First question");

        mockMvc.perform(post("/api/projects/{projectId}/messages", projectId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "content": "Second question"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("USER"))
                .andExpect(jsonPath("$.content").value("Second question"));

        mockMvc.perform(get("/api/projects/{projectId}/messages", projectId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].content").value("First question"))
                .andExpect(jsonPath("$[1].content").value("Second question"));
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

    private String createProject(String prompt) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/projects")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "prompt": "%s",
                                  "model": {
                                    "provider": "deepseek",
                                    "model": "deepseek"
                                  }
                                }
                                """.formatted(prompt)))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode project = objectMapper.readTree(result.getResponse().getContentAsString());
        return project.get("id").asText();
    }
}
