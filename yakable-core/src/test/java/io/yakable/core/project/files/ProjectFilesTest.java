package io.yakable.core.project.files;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static io.yakable.core.project.files.ProjectFiles.PublicationResult.ALREADY_PUBLISHED;
import static io.yakable.core.project.files.ProjectFiles.PublicationResult.PUBLISHED;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProjectFilesTest {

    @TempDir
    Path tempDir;

    @Test
    void shouldRejectEmptyProjectFiles() {
        ProjectFiles projectFiles = new ProjectFiles(tempDir);

        assertThatThrownBy(() -> projectFiles.publish("project-1", "turn-1", List.of()))
                .isInstanceOf(ProjectFiles.ProjectFilesException.class)
                .hasMessageContaining("must not be empty");
    }

    @Test
    void shouldPublishCompleteProjectAndRememberPublication() throws Exception {
        ProjectFiles projectFiles = new ProjectFiles(tempDir);

        assertThat(projectFiles.publish(
                "project-1",
                "turn-1",
                List.of(
                        new ProjectFile("package.json", "{}"),
                        new ProjectFile("src/App.tsx", "export default function App() {}"))))
                .isEqualTo(PUBLISHED);

        assertThat(Files.readString(tempDir.resolve("project-1/package.json"))).isEqualTo("{}");
        assertThat(Files.readString(tempDir.resolve("project-1/src/App.tsx")))
                .isEqualTo("export default function App() {}");
        assertThat(projectFiles.isPublished("project-1", "turn-1")).isTrue();
    }

    @Test
    void shouldReturnAlreadyPublishedWithoutOverwritingFiles() throws Exception {
        ProjectFiles projectFiles = new ProjectFiles(tempDir);
        projectFiles.publish("project-1", "turn-1", List.of(new ProjectFile("src/App.tsx", "first")));

        assertThat(projectFiles.publish(
                "project-1", "turn-1", List.of(new ProjectFile("src/App.tsx", "second"))))
                .isEqualTo(ALREADY_PUBLISHED);

        assertThat(Files.readString(tempDir.resolve("project-1/src/App.tsx"))).isEqualTo("first");
    }

    @Test
    void shouldRejectDifferentPublicationAfterProjectWasPublished() {
        ProjectFiles projectFiles = new ProjectFiles(tempDir);
        projectFiles.publish("project-1", "turn-1", List.of(new ProjectFile("src/App.tsx", "first")));

        assertThatThrownBy(() -> projectFiles.publish(
                "project-1", "turn-2", List.of(new ProjectFile("src/App.tsx", "second"))))
                .isInstanceOf(ProjectFiles.ProjectFilesException.class)
                .hasMessageContaining("already exist");
    }

    @Test
    void shouldRejectUnsafePathsBeforePublishingAnyProjectFiles() {
        ProjectFiles projectFiles = new ProjectFiles(tempDir);

        assertThatThrownBy(() -> projectFiles.publish(
                "project-1",
                "turn-1",
                List.of(
                        new ProjectFile("src/App.tsx", "valid"),
                        new ProjectFile("../outside.txt", "invalid"))))
                .isInstanceOf(ProjectFiles.ProjectFilesException.class);

        assertThat(Files.exists(tempDir.resolve("project-1"))).isFalse();
        assertThat(Files.exists(tempDir.resolve("outside.txt"))).isFalse();
    }

    @Test
    void shouldRejectAbsolutePath() {
        ProjectFiles projectFiles = new ProjectFiles(tempDir);

        assertThatThrownBy(() -> projectFiles.publish(
                "project-1", "turn-1", List.of(new ProjectFile("/tmp/outside.txt", "invalid"))))
                .isInstanceOf(ProjectFiles.ProjectFilesException.class)
                .hasMessageContaining("must be relative");

        assertThat(Files.exists(tempDir.resolve("project-1"))).isFalse();
    }

    @Test
    void shouldRejectDuplicateAndFileDirectoryPathConflicts() {
        ProjectFiles projectFiles = new ProjectFiles(tempDir);

        assertThatThrownBy(() -> projectFiles.publish(
                "project-1",
                "turn-1",
                List.of(new ProjectFile("src/App.tsx", "a"), new ProjectFile("src/./App.tsx", "b"))))
                .isInstanceOf(ProjectFiles.ProjectFilesException.class)
                .hasMessageContaining("Duplicate");

        assertThatThrownBy(() -> projectFiles.publish(
                "project-2",
                "turn-2",
                List.of(new ProjectFile("src", "a"), new ProjectFile("src/App.tsx", "b"))))
                .isInstanceOf(ProjectFiles.ProjectFilesException.class)
                .hasMessageContaining("conflicts");
    }

    @Test
    void shouldProtectInternalMetadataPath() {
        ProjectFiles projectFiles = new ProjectFiles(tempDir);

        assertThatThrownBy(() -> projectFiles.publish(
                "project-1", "turn-1", List.of(new ProjectFile(".yakable/publication-id", "fake"))))
                .isInstanceOf(ProjectFiles.ProjectFilesException.class)
                .hasMessageContaining("reserved");
    }

    @Test
    void shouldEnforceFileCountSingleFileAndTotalByteLimits() {
        assertThatThrownBy(() -> new ProjectFiles(tempDir, 1, 10, 20).publish(
                "project-count",
                "turn-count",
                List.of(new ProjectFile("a.txt", "a"), new ProjectFile("b.txt", "b"))))
                .isInstanceOf(ProjectFiles.ProjectFilesException.class)
                .hasMessageContaining("count");

        assertThatThrownBy(() -> new ProjectFiles(tempDir, 10, 3, 20).publish(
                "project-single", "turn-single", List.of(new ProjectFile("a.txt", "1234"))))
                .isInstanceOf(ProjectFiles.ProjectFilesException.class)
                .hasMessageContaining("byte limit");

        assertThatThrownBy(() -> new ProjectFiles(tempDir, 10, 10, 5).publish(
                "project-total",
                "turn-total",
                List.of(new ProjectFile("a.txt", "123"), new ProjectFile("b.txt", "123"))))
                .isInstanceOf(ProjectFiles.ProjectFilesException.class)
                .hasMessageContaining("total byte limit");
    }

    @Test
    void shouldKeepProjectIdInsideOneDirectRoot() {
        ProjectFiles projectFiles = new ProjectFiles(tempDir);

        assertThatThrownBy(() -> projectFiles.publish(
                "../other", "turn-1", List.of(new ProjectFile("a.txt", "a"))))
                .isInstanceOf(ProjectFiles.ProjectFilesException.class)
                .hasMessageContaining("direct Project Root");
    }
}
