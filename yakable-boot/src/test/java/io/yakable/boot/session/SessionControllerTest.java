package io.yakable.boot.session;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.yakable.application.async.TurnDispatcher;
import io.yakable.application.model.ModelGateway;
import io.yakable.application.model.ModelReply;
import io.yakable.application.session.TurnExecutor;
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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class SessionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TurnExecutor turnExecutor;

    @MockBean
    private TurnDispatcher turnDispatcher;

    @MockBean
    private ModelGateway modelGateway;

    @BeforeEach
    void setUpModelGateway() {
        when(modelGateway.chat(anyString(), any())).thenReturn(
                new ModelReply("I am Yakable.")
        );
    }

    @Test
    void projectCreationPersistsInitialPendingTurnBeforeNavigation()
            throws Exception {
        ProjectRef project = createProject("Who are you?");

        mockMvc.perform(get(
                            "/api/projects/{projectId}/sessions/{sessionId}",
                            project.projectId(),
                            project.sessionId()
                        ))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.session.id")
                        .value(project.sessionId()))
                .andExpect(jsonPath("$.session.projectId")
                        .value(project.projectId()))
                .andExpect(jsonPath("$.session.model.provider")
                        .value("deepseek"))
                .andExpect(jsonPath("$.turns[0].status")
                        .value("PENDING"))
                .andExpect(jsonPath("$.messages[0].role")
                        .value("USER"))
                .andExpect(jsonPath("$.messages[0].content")
                        .value("Who are you?"))
                .andExpect(jsonPath("$.messages[0].sequence")
                        .value(1));
    }

    @Test
    void startsANewTurnAfterThePreviousTurnCompletes()
            throws Exception {
        ProjectRef project = createProject("First question");

        JsonNode initialSnapshot = getSession(project);
        String initialTurnId = initialSnapshot
                .path("turns")
                .path(0)
                .path("id")
                .asText();

        turnExecutor.execute(initialTurnId);
        reset(turnDispatcher);

        mockMvc.perform(post(
                            "/api/projects/{projectId}/sessions/{sessionId}/turns",
                            project.projectId(),
                            project.sessionId()
                        )
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "content": "Second question"
                                }
                                """))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.turn.status")
                        .value("PENDING"))
                .andExpect(jsonPath("$.userMessage.role")
                        .value("USER"))
                .andExpect(jsonPath("$.userMessage.content")
                        .value("Second question"))
                .andExpect(jsonPath("$.userMessage.sequence")
                        .value(3));

        verify(turnDispatcher).dispatch(anyString());
    }

    @Test
    void rejectsAnotherTurnWhileTheSessionIsBusy()
            throws Exception {
        ProjectRef project = createProject("First question");

        mockMvc.perform(post(
                            "/api/projects/{projectId}/sessions/{sessionId}/turns",
                            project.projectId(),
                            project.sessionId()
                        )
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "content": "Second question"
                                }
                                """))
                .andExpect(status().isConflict());
    }

    @Test
    void returnsNotFoundWhenSessionDoesNotBelongToProject()
            throws Exception {
        ProjectRef project = createProject("First question");

        mockMvc.perform(get(
                            "/api/projects/project-other/sessions/{sessionId}",
                            project.sessionId()
                        ))
                .andExpect(status().isNotFound());
    }

    @Test
    void returnsNotFoundForUnknownSession() throws Exception {
        mockMvc.perform(get(
                            "/api/projects/project-1/sessions/missing"
                        ))
                .andExpect(status().isNotFound());
    }

    private JsonNode getSession(ProjectRef project) throws Exception {
        MvcResult result = mockMvc.perform(get(
                            "/api/projects/{projectId}/sessions/{sessionId}",
                            project.projectId(),
                            project.sessionId()
                        ))
                .andExpect(status().isOk())
                .andReturn();

        return objectMapper.readTree(
                result.getResponse().getContentAsString()
        );
    }

    private ProjectRef createProject(String prompt) throws Exception {
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

        JsonNode project = objectMapper.readTree(
                result.getResponse().getContentAsString()
        );
        return new ProjectRef(
                project.get("id").asText(),
                project.get("latestSessionId").asText()
        );
    }

    private record ProjectRef(
            String projectId,
            String sessionId
    ) {
    }
}
