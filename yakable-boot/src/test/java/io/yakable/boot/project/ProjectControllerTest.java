package io.yakable.boot.project;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.yakable.application.async.TurnDispatcher;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class ProjectControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private TurnDispatcher turnDispatcher;

    @Test
    void listsProjectsAsAPage() throws Exception {
        mockMvc.perform(get("/api/projects")
                        .queryParam("current", "1")
                        .queryParam("pageSize", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.records").isArray())
                .andExpect(jsonPath("$.total").isNumber())
                .andExpect(jsonPath("$.pages").isNumber())
                .andExpect(jsonPath("$.current").value(1))
                .andExpect(jsonPath("$.pageSize").value(20));
    }

    @Test
    void rejectsInvalidProjectPageSize() throws Exception {
        mockMvc.perform(get("/api/projects")
                        .queryParam("pageSize", "101"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createsProjectWithInitialSessionAndReadsItById()
            throws Exception {
        MvcResult result = mockMvc.perform(post("/api/projects")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "prompt": "Build a CRM dashboard",
                                  "model": {
                                    "provider": "deepseek",
                                    "model": "deepseek-flash"
                                  }
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name")
                        .value("Build a CRM dashboard"))
                .andExpect(jsonPath("$.latestSessionId").isString())
                .andExpect(jsonPath("$.status").value("CREATED"))
                .andReturn();

        JsonNode createdProject = objectMapper.readTree(
                result.getResponse().getContentAsString()
        );
        String projectId = createdProject.get("id").asText();
        String latestSessionId = createdProject
                .get("latestSessionId")
                .asText();

        verify(turnDispatcher).dispatch(anyString());

        mockMvc.perform(get("/api/projects/{projectId}", projectId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(projectId))
                .andExpect(jsonPath("$.latestSessionId")
                        .value(latestSessionId));
    }

    @Test
    void rejectsBlankPrompt() throws Exception {
        mockMvc.perform(post("/api/projects")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "prompt": "   ",
                                  "model": {
                                    "provider": "deepseek",
                                    "model": "deepseek-flash"
                                  }
                                }
                                """))
                .andExpect(status().isBadRequest());
    }
}
