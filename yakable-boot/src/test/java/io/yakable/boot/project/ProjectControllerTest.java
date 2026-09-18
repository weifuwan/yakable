package io.yakable.boot.project;

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
class ProjectControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void listsProjects() throws Exception {
        mockMvc.perform(get("/api/projects"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void createsProjectAndReadsItById() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/projects")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "prompt": "Build a CRM dashboard",
                                  "model": {
                                    "provider": "deepseek",
                                    "model": "deepseek"
                                  }
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Build a CRM dashboard"))
                .andExpect(jsonPath("$.prompt").value("Build a CRM dashboard"))
                .andExpect(jsonPath("$.model.provider").value("deepseek"))
                .andExpect(jsonPath("$.model.model").value("deepseek"))
                .andExpect(jsonPath("$.status").value("CREATED"))
                .andReturn();

        JsonNode createdProject = objectMapper.readTree(result.getResponse().getContentAsString());
        String projectId = createdProject.get("id").asText();

        mockMvc.perform(get("/api/projects/{projectId}", projectId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(projectId))
                .andExpect(jsonPath("$.prompt").value("Build a CRM dashboard"));
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
                                    "model": "deepseek"
                                  }
                                }
                                """))
                .andExpect(status().isBadRequest());
    }
}
