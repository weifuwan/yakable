package io.yakable.core.project.files;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Stream;

/**
 * Project 文件完整发布与只读访问能力。
 *
 * <p>负责 Project Root 隔离、资源边界、staging、完整发布、publication 幂等和已发布文件读取，
 * 不负责 Project ownership、Turn 状态或业务持久化。</p>
 */
public class ProjectFiles {

    public static final int DEFAULT_MAX_FILES = 200;
    public static final long DEFAULT_MAX_FILE_BYTES = 1024L * 1024L;
    public static final long DEFAULT_MAX_TOTAL_BYTES = 10L * 1024L * 1024L;

    private static final String STAGING_DIRECTORY = ".yakable-staging";
    private static final String METADATA_DIRECTORY = ".yakable";
    private static final String PUBLICATION_FILE = "publication-id";
    private static final int MAX_PUBLICATION_ID_LENGTH = 256;

    private final Path root;
    private final Path stagingRoot;
    private final int maxFiles;
    private final long maxFileBytes;
    private final long maxTotalBytes;

    public ProjectFiles(Path root) {
        this(root, DEFAULT_MAX_FILES, DEFAULT_MAX_FILE_BYTES, DEFAULT_MAX_TOTAL_BYTES);
    }

    public ProjectFiles(Path root, int maxFiles, long maxFileBytes, long maxTotalBytes) {
        this.root = Objects.requireNonNull(root, "root").toAbsolutePath().normalize();
        this.stagingRoot = this.root.resolve(STAGING_DIRECTORY);
        if (maxFiles <= 0 || maxFileBytes <= 0 || maxTotalBytes <= 0) {
            throw new IllegalArgumentException("Project file limits must be greater than zero");
        }
        this.maxFiles = maxFiles;
        this.maxFileBytes = maxFileBytes;
        this.maxTotalBytes = maxTotalBytes;
    }

    /**
     * 完整发布一批 Project 文件。
     *
     * <p>同一个 publicationId 已发布时直接返回 ALREADY_PUBLISHED，不覆盖已有文件。</p>
     */
    public PublicationResult publish(String projectId, String publicationId, List<ProjectFile> files) {
        String publication = requirePublicationId(publicationId);
        Path projectRoot = projectRoot(projectId);
        List<ValidatedFile> validated = validateFiles(projectRoot, files);

        if (publicationMatches(projectRoot, publication)) {
            return PublicationResult.ALREADY_PUBLISHED;
        }
        if (Files.exists(projectRoot, LinkOption.NOFOLLOW_LINKS)) {
            throw new ProjectFilesException("Project files already exist for project: " + projectId);
        }

        Path stage = null;
        try {
            Files.createDirectories(stagingRoot);
            if (Files.isSymbolicLink(stagingRoot) || !Files.isDirectory(stagingRoot, LinkOption.NOFOLLOW_LINKS)) {
                throw new ProjectFilesException("Project staging root must be a real directory");
            }
            stage = Files.createTempDirectory(stagingRoot, "publish-");
            writeStage(stage, publication, validated);
            try {
                Files.move(stage, projectRoot, StandardCopyOption.ATOMIC_MOVE);
            } catch (IOException moveFailure) {
                if (publicationMatches(projectRoot, publication)) {
                    return PublicationResult.ALREADY_PUBLISHED;
                }
                if (Files.exists(projectRoot, LinkOption.NOFOLLOW_LINKS)) {
                    throw new ProjectFilesException("Project files already published by another publication: " + projectId, moveFailure);
                }
                throw moveFailure;
            }
            return PublicationResult.PUBLISHED;
        } catch (IOException exception) {
            throw new ProjectFilesException("Failed to publish project files: " + projectId, exception);
        } finally {
            deleteStageQuietly(stage);
        }
    }

    /**
     * 判断指定 publication 是否已经完整发布。
     */
    public boolean isPublished(String projectId, String publicationId) {
        return publicationMatches(projectRoot(projectId), requirePublicationId(publicationId));
    }

    /**
     * 列出当前 Project 已完整发布的用户文件相对路径。
     *
     * <p>未形成有效 publication 时返回空列表；内部 metadata、staging 路径和 Symbolic Link 不对外暴露。</p>
     */
    public List<String> listPublished(String projectId) {
        Path projectRoot = projectRoot(projectId);
        if (!hasValidPublication(projectRoot)) {
            return List.of();
        }
        try (Stream<Path> paths = Files.walk(projectRoot)) {
            List<String> result = paths
                    .filter(path -> !path.equals(projectRoot))
                    .filter(path -> {
                        Path relative = projectRoot.relativize(path);
                        return !isInternalPath(relative)
                                && !Files.isSymbolicLink(path)
                                && Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS);
                    })
                    .map(path -> projectRoot.relativize(path).normalize().toString())
                    .limit((long) maxFiles + 1)
                    .sorted()
                    .toList();
            if (result.size() > maxFiles) {
                throw new ProjectFilesException("Published project file count exceeds limit: " + maxFiles);
            }
            return result;
        } catch (IOException | UncheckedIOException exception) {
            throw new ProjectFilesException("Failed to list published project files: " + projectId, exception);
        }
    }

    /**
     * 读取当前 Project 已完整发布的单个文本文件。
     */
    public ProjectFile readPublished(String projectId, String path) {
        Path projectRoot = projectRoot(projectId);
        if (!hasValidPublication(projectRoot)) {
            throw new ProjectFilesException("Project files are not published: " + projectId);
        }

        Path relative = relativePath(path);
        if (isInternalPath(relative)) {
            throw new ProjectFilesException("Project file path is reserved: " + path);
        }
        Path target = projectRoot.resolve(relative).normalize();
        if (!target.startsWith(projectRoot)) {
            throw new ProjectFilesException("Project file escapes Project Root: " + path);
        }
        rejectSymbolicLinks(projectRoot, relative);

        try {
            if (!Files.isRegularFile(target, LinkOption.NOFOLLOW_LINKS)) {
                throw new ProjectFilesException("Published project file not found: " + path);
            }
            if (Files.size(target) > maxFileBytes) {
                throw new ProjectFilesException("Published project file exceeds byte limit: " + path);
            }
            return new ProjectFile(relative.toString(), Files.readString(target, StandardCharsets.UTF_8));
        } catch (IOException exception) {
            throw new ProjectFilesException("Failed to read published project file: " + path, exception);
        }
    }

    private List<ValidatedFile> validateFiles(Path projectRoot, List<ProjectFile> files) {
        Objects.requireNonNull(files, "files");
        if (files.isEmpty()) {
            throw new ProjectFilesException("Project files must not be empty");
        }
        if (files.size() > maxFiles) {
            throw new ProjectFilesException("Project file count exceeds limit: " + maxFiles);
        }

        List<ValidatedFile> result = new ArrayList<>(files.size());
        Set<Path> paths = new HashSet<>();
        long totalBytes = 0;
        for (ProjectFile file : files) {
            Objects.requireNonNull(file, "file");
            Path relative = relativePath(file.path());
            if (isInternalPath(relative)) {
                throw new ProjectFilesException("Project file path is reserved: " + file.path());
            }
            Path target = projectRoot.resolve(relative).normalize();
            if (!target.startsWith(projectRoot)) {
                throw new ProjectFilesException("Project file escapes Project Root: " + file.path());
            }
            if (!paths.add(relative)) {
                throw new ProjectFilesException("Duplicate project file path: " + file.path());
            }
            for (Path existing : paths) {
                if (!existing.equals(relative) && (existing.startsWith(relative) || relative.startsWith(existing))) {
                    throw new ProjectFilesException("Project file path conflicts with another file: " + file.path());
                }
            }

            byte[] content = file.content().getBytes(StandardCharsets.UTF_8);
            if (content.length > maxFileBytes) {
                throw new ProjectFilesException("Project file exceeds byte limit: " + file.path());
            }
            if (totalBytes > maxTotalBytes - content.length) {
                throw new ProjectFilesException("Project files exceed total byte limit: " + maxTotalBytes);
            }
            totalBytes += content.length;
            result.add(new ValidatedFile(relative, content));
        }
        return List.copyOf(result);
    }

    private Path relativePath(String value) {
        if (value == null || value.isBlank()) {
            throw new ProjectFilesException("Project file path must not be blank");
        }
        try {
            Path path = Path.of(value);
            if (path.isAbsolute()) {
                throw new ProjectFilesException("Project file path must be relative: " + value);
            }
            for (Path segment : path) {
                if ("..".equals(segment.toString())) {
                    throw new ProjectFilesException("Project file path must not contain parent traversal: " + value);
                }
            }
            Path normalized = path.normalize();
            if (normalized.getNameCount() == 0 || ".".equals(normalized.toString())) {
                throw new ProjectFilesException("Project file path must identify a file: " + value);
            }
            return normalized;
        } catch (InvalidPathException exception) {
            throw new ProjectFilesException("Invalid project file path: " + value, exception);
        }
    }

    private boolean isInternalPath(Path relative) {
        if (relative.getNameCount() == 0) {
            return false;
        }
        String first = relative.getName(0).toString();
        return METADATA_DIRECTORY.equals(first) || STAGING_DIRECTORY.equals(first);
    }

    private void rejectSymbolicLinks(Path projectRoot, Path relative) {
        if (Files.isSymbolicLink(projectRoot)) {
            throw new ProjectFilesException("Project Root must not be a symbolic link");
        }
        Path current = projectRoot;
        for (Path segment : relative) {
            current = current.resolve(segment);
            if (Files.isSymbolicLink(current)) {
                throw new ProjectFilesException("Project file path must not contain symbolic links: " + relative);
            }
        }
    }

    private Path projectRoot(String projectId) {
        if (projectId == null || projectId.isBlank()) {
            throw new ProjectFilesException("projectId must not be blank");
        }
        Path projectRoot;
        try {
            projectRoot = root.resolve(projectId).normalize();
        } catch (InvalidPathException exception) {
            throw new ProjectFilesException("Invalid projectId: " + projectId, exception);
        }
        if (projectRoot.equals(stagingRoot) || !root.equals(projectRoot.getParent())) {
            throw new ProjectFilesException("projectId must resolve to one direct Project Root: " + projectId);
        }
        return projectRoot;
    }

    private String requirePublicationId(String publicationId) {
        if (publicationId == null || publicationId.isBlank()) {
            throw new ProjectFilesException("publicationId must not be blank");
        }
        if (publicationId.length() > MAX_PUBLICATION_ID_LENGTH) {
            throw new ProjectFilesException("publicationId exceeds max length: " + MAX_PUBLICATION_ID_LENGTH);
        }
        return publicationId;
    }

    private void writeStage(Path stage, String publicationId, List<ValidatedFile> files) throws IOException {
        for (ValidatedFile file : files) {
            Path target = stage.resolve(file.path());
            Files.createDirectories(target.getParent());
            Files.write(target, file.content(), StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE);
        }
        Path metadata = stage.resolve(METADATA_DIRECTORY);
        Files.createDirectories(metadata);
        Files.writeString(
                metadata.resolve(PUBLICATION_FILE),
                publicationId,
                StandardCharsets.UTF_8,
                StandardOpenOption.CREATE_NEW,
                StandardOpenOption.WRITE);
    }

    private boolean hasValidPublication(Path projectRoot) {
        return readPublicationId(projectRoot) != null;
    }

    private boolean publicationMatches(Path projectRoot, String publicationId) {
        return publicationId.equals(readPublicationId(projectRoot));
    }

    private String readPublicationId(Path projectRoot) {
        Path metadata = projectRoot.resolve(METADATA_DIRECTORY);
        Path marker = metadata.resolve(PUBLICATION_FILE);
        if (!Files.isDirectory(projectRoot, LinkOption.NOFOLLOW_LINKS)
                || !Files.isDirectory(metadata, LinkOption.NOFOLLOW_LINKS)
                || !Files.isRegularFile(marker, LinkOption.NOFOLLOW_LINKS)) {
            return null;
        }
        try {
            if (Files.size(marker) > MAX_PUBLICATION_ID_LENGTH) {
                return null;
            }
            String publicationId = Files.readString(marker, StandardCharsets.UTF_8);
            if (publicationId.isBlank() || publicationId.length() > MAX_PUBLICATION_ID_LENGTH) {
                return null;
            }
            return publicationId;
        } catch (IOException exception) {
            throw new ProjectFilesException("Failed to read Project publication marker: " + projectRoot.getFileName(), exception);
        }
    }

    private void deleteStageQuietly(Path stage) {
        if (stage == null || !Files.exists(stage, LinkOption.NOFOLLOW_LINKS)) {
            return;
        }
        try (Stream<Path> paths = Files.walk(stage)) {
            paths.sorted(Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException ignored) {
                    // Staging cleanup failure must not change publication result.
                }
            });
        } catch (IOException ignored) {
            // Hidden staging residue is not a published Project result.
        }
    }

    private record ValidatedFile(Path path, byte[] content) {
    }

    public enum PublicationResult {
        PUBLISHED,
        ALREADY_PUBLISHED
    }

    public static final class ProjectFilesException extends RuntimeException {

        public ProjectFilesException(String message) {
            super(message);
        }

        public ProjectFilesException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
