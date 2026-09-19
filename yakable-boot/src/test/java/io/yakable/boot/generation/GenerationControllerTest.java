package io.yakable.boot.generation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class GenerationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void startsOneActiveGenerationRunPerProject() throws Exception {
        String projectId = createProject();

        MvcResult first = mockMvc.perform(put("/api/projects/{projectId}/generation", projectId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.projectId").value(projectId))
                .andExpect(jsonPath("$.status").value("RUNNING"))
                .andExpect(jsonPath("$.steps[0].key").value("PREPARING"))
                .andExpect(jsonPath("$.steps[0].status").value("RUNNING"))
                .andExpect(jsonPath("$.steps[1].key").value("PLANNING"))
                .andExpect(jsonPath("$.steps[1].status").value("PENDING"))
                .andExpect(jsonPath("$.steps[2].status").value("PENDING"))
                .andExpect(jsonPath("$.steps[3].status").value("PENDING"))
                .andReturn();

        String firstRunId = objectMapper
                .readTree(first.getResponse().getContentAsString())
                .get("id")
                .asText();

        MvcResult second = mockMvc.perform(put("/api/projects/{projectId}/generation", projectId))
                .andExpect(status().isOk())
                .andReturn();

        String secondRunId = objectMapper
                .readTree(second.getResponse().getContentAsString())
                .get("id")
                .asText();

        org.junit.jupiter.api.Assertions.assertEquals(firstRunId, secondRunId);
    }

    @Test
    void rejectsGenerationForUnknownProject() throws Exception {
        mockMvc.perform(put("/api/projects/{projectId}/generation", "missing-project"))
                .andExpect(status().isNotFound());
    }

    private String createProject() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/projects")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "prompt": "Build a project",
                                  "model": {
                                    "provider": "deepseek",
                                    "model": "deepseek"
                                  }
                                }
                                """))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode project = objectMapper.readTree(result.getResponse().getContentAsString());
        return project.get("id").asText();
    }
}
