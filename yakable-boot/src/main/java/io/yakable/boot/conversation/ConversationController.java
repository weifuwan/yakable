package io.yakable.boot.conversation;

import io.yakable.core.conversation.ConversationMessage;
import io.yakable.core.conversation.ConversationService;
import io.yakable.core.conversation.ConversationTurn;
import io.yakable.core.llm.LlmProviderException;
import io.yakable.core.project.Project;
import io.yakable.core.project.ProjectQueryService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/projects/{projectId}/messages")
public class ConversationController {

    private final ProjectQueryService projectQueryService;
    private final ConversationService conversationService;

    public ConversationController(
            ProjectQueryService projectQueryService,
            ConversationService conversationService
    ) {
        this.projectQueryService = projectQueryService;
        this.conversationService = conversationService;
    }

    @GetMapping
    public List<MessageResponse> listMessages(@PathVariable String projectId) {
        requireProject(projectId);

        return conversationService.listMessages(projectId).stream()
                .map(MessageResponse::from)
                .toList();
    }

    @PostMapping
    public ResponseEntity<ConversationTurnResponse> sendMessage(
            @PathVariable String projectId,
            @RequestBody SendMessageRequest request
    ) {
        Project project = requireProject(projectId);

        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "content is required");
        }

        ConversationTurn turn;
        try {
            turn = conversationService.sendMessage(
                    projectId,
                    project.provider(),
                    project.model(),
                    request.content()
            );
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    exception.getMessage(),
                    exception
            );
        } catch (LlmProviderException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    exception.getMessage(),
                    exception
            );
        }

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ConversationTurnResponse.from(turn));
    }

    private Project requireProject(String projectId) {
        return projectQueryService.getProject(projectId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Project not found"
                ));
    }

    public record SendMessageRequest(String content) {
    }

    public record ConversationTurnResponse(
            MessageResponse userMessage,
            MessageResponse assistantMessage
    ) {

        static ConversationTurnResponse from(ConversationTurn turn) {
            return new ConversationTurnResponse(
                    MessageResponse.from(turn.userMessage()),
                    MessageResponse.from(turn.assistantMessage())
            );
        }
    }

    public record MessageResponse(
            String id,
            ConversationMessage.Role role,
            String content,
            Instant createdAt
    ) {

        static MessageResponse from(ConversationMessage message) {
            return new MessageResponse(
                    message.id(),
                    message.role(),
                    message.content(),
                    message.createdAt()
            );
        }
    }
}
