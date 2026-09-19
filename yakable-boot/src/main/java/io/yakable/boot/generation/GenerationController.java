package io.yakable.boot.generation;

import io.yakable.core.generation.GenerationRun;
import io.yakable.core.generation.GenerationService;
import io.yakable.core.project.ProjectQueryService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/projects/{projectId}/generation")
public class GenerationController {

    private final ProjectQueryService projectQueryService;
    private final GenerationService generationService;

    public GenerationController(
            ProjectQueryService projectQueryService,
            GenerationService generationService
    ) {
        this.projectQueryService = projectQueryService;
        this.generationService = generationService;
    }

    @PutMapping
    public GenerationRunResponse ensureGeneration(@PathVariable String projectId) {
        projectQueryService.getProject(projectId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Project not found"
                ));

        return GenerationRunResponse.from(generationService.ensureRunning(projectId));
    }

    public record GenerationRunResponse(
            String id,
            String projectId,
            GenerationRun.Status status,
            List<GenerationStepResponse> steps,
            Instant startedAt,
            Instant updatedAt
    ) {

        static GenerationRunResponse from(GenerationRun run) {
            return new GenerationRunResponse(
                    run.id(),
                    run.projectId(),
                    run.status(),
                    run.steps().stream()
                            .map(GenerationStepResponse::from)
                            .toList(),
                    run.startedAt(),
                    run.updatedAt()
            );
        }
    }

    public record GenerationStepResponse(
            GenerationRun.StepKey key,
            GenerationRun.StepStatus status
    ) {

        static GenerationStepResponse from(GenerationRun.Step step) {
            return new GenerationStepResponse(step.key(), step.status());
        }
    }
}
