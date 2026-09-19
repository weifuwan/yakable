package io.yakable.boot.conversation;

import io.yakable.core.conversation.ConversationMessage;
import io.yakable.core.conversation.ConversationService;
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

import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
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
        Project project = requireProject(projectId);

        List<MessageResponse> messages = new ArrayList<>();
        messages.add(MessageResponse.initial(project));
        messages.addAll(
                conversationService.listMessages(projectId).stream()
                        .map(MessageResponse::from)
                        .toList()
        );
        return messages;
    }

    @PostMapping
    public ResponseEntity<MessageResponse> sendMessage(
            @PathVariable String projectId,
            @RequestBody SendMessageRequest request
    ) {
        requireProject(projectId);

        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "content is required");
        }

        ConversationMessage message;
        try {
            message = conversationService.appendUserMessage(projectId, request.content());
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "content must not be blank",
                    exception
            );
        }

        return ResponseEntity
                .created(URI.create("/api/projects/" + projectId + "/messages/" + message.id()))
                .body(MessageResponse.from(message));
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

    public record MessageResponse(
            String id,
            ConversationMessage.Role role,
            String content,
            Instant createdAt
    ) {

        static MessageResponse initial(Project project) {
            return new MessageResponse(
                    "initial-" + project.id(),
                    ConversationMessage.Role.USER,
                    project.prompt(),
                    project.createdAt()
            );
        }

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
