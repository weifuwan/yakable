package io.yakable.boot.integration;

import io.yakable.boot.YakableApplication;
import io.yakable.common.enums.session.MessageRoleEnum;
import io.yakable.common.enums.session.TurnStatusEnum;
import io.yakable.common.enums.session.TurnTypeEnum;
import io.yakable.dao.entity.MessageEntity;
import io.yakable.dao.entity.TurnEntity;
import io.yakable.dao.repository.MessageRepository;
import io.yakable.dao.repository.TurnRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Testcontainers
@SpringBootTest(
        classes = YakableApplication.class,
        properties = {
                "yakable.turn-execution.recovery-interval=1h",
                "yakable.runtime.shutdown-timeout=1s",
                "spring.datasource.hikari.maximum-pool-size=4"
        })
class ConversationPersistenceIT {

    @Container
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4")
            .withDatabaseName("yakable")
            .withUsername("yakable")
            .withPassword("yakable");

    @DynamicPropertySource
    static void mysqlProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
    }

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private TurnRepository turnRepository;

    @Autowired
    private MessageRepository messageRepository;

    @BeforeEach
    void cleanConversationData() {
        jdbcTemplate.update("DELETE FROM yak_message");
        jdbcTemplate.update("DELETE FROM yak_turn");
        jdbcTemplate.update("DELETE FROM yak_session");
        jdbcTemplate.update("DELETE FROM yak_project");
    }

    @Test
    void shouldApplyLatestFlywaySchema() {
        String contentType = jdbcTemplate.queryForObject(
                """
                SELECT DATA_TYPE
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'yak_message'
                  AND COLUMN_NAME = 'content'
                """,
                String.class);
        Integer latestVersion = jdbcTemplate.queryForObject(
                """
                SELECT MAX(CAST(version AS UNSIGNED))
                FROM yakable_schema_history
                WHERE success = 1
                """,
                Integer.class);

        assertThat(contentType).isEqualTo("mediumtext");
        assertThat(latestVersion).isEqualTo(2);
    }

    @Test
    void shouldEnforceConversationUniquenessBoundaries() {
        insertProject("project-1", "user-1", "project-request-1");

        assertThatThrownBy(() ->
                insertProject("project-duplicate", "user-1", "project-request-1"))
                .isInstanceOf(DataIntegrityViolationException.class);

        insertProject("project-other-user", "user-2", "project-request-1");

        insertSession("session-1", "project-1", "user-1");
        assertThatThrownBy(() ->
                insertSession("session-duplicate", "project-1", "user-1"))
                .isInstanceOf(DataIntegrityViolationException.class);

        insertTurn("turn-1", "session-1", "turn-request-1", TurnStatusEnum.PENDING, null);
        assertThatThrownBy(() ->
                insertTurn(
                        "turn-duplicate",
                        "session-1",
                        "turn-request-1",
                        TurnStatusEnum.PENDING,
                        null))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void shouldQueryUserNavigationMessagesAndMessageBySequence() {
        insertProject("project-1", "user-1", "project-request-1");
        insertSession("session-1", "project-1", "user-1");
        insertTurn("turn-1", "session-1", "turn-request-1", TurnStatusEnum.SUCCEEDED, null);
        insertTurn("turn-2", "session-1", "turn-request-2", TurnStatusEnum.SUCCEEDED, null);
        insertMessage("message-1", "session-1", "turn-1", MessageRoleEnum.USER, "First", 1L);
        insertMessage("message-2", "session-1", "turn-1", MessageRoleEnum.ASSISTANT, "Answer", 2L);
        insertMessage(
                "message-3",
                "session-1",
                "turn-2",
                MessageRoleEnum.USER,
                "  Build\n\t" + "界".repeat(170) + "  ",
                3L);

        List<MessageEntity> navigation = messageRepository.queryUserNavigationMessageList("session-1");
        assertThat(navigation)
                .extracting(MessageEntity::getId)
                .containsExactly("message-1", "message-3");
        assertThat(navigation.get(1).getContent()).doesNotContain("\n", "\t");
        assertThat(navigation.get(1).getContent().codePointCount(0, navigation.get(1).getContent().length()))
                .isEqualTo(160);

        assertThat(messageRepository.queryMessage("session-1", 2L))
                .get()
                .extracting(MessageEntity::getId)
                .isEqualTo("message-2");
    }

    @Test
    void shouldNotOverwriteTerminalTurnWithLateEvents() {
        insertProject("project-1", "user-1", "project-request-1");
        insertSession("session-1", "project-1", "user-1");
        insertTurn(
                "turn-1",
                "session-1",
                "turn-request-1",
                TurnStatusEnum.RUNNING,
                LocalDateTime.of(2026, 9, 22, 10, 0));

        int succeeded = turnRepository.updateTurnSucceeded(
                "turn-1",
                "session-1",
                10L,
                5L,
                15L,
                "provider-request-1",
                "stop",
                LocalDateTime.of(2026, 9, 22, 10, 1));
        int lateFailure = turnRepository.updateTurnFailed(
                "turn-1",
                "session-1",
                "late failure",
                LocalDateTime.of(2026, 9, 22, 10, 2));
        int lateStop = turnRepository.updateTurnStopped(
                "turn-1",
                "session-1",
                LocalDateTime.of(2026, 9, 22, 10, 3));

        TurnEntity persisted = turnRepository.queryById("turn-1").orElseThrow();

        assertThat(succeeded).isEqualTo(1);
        assertThat(lateFailure).isZero();
        assertThat(lateStop).isZero();
        assertThat(persisted.getStatus()).isEqualTo(TurnStatusEnum.SUCCEEDED);
        assertThat(persisted.getProviderRequestId()).isEqualTo("provider-request-1");
    }

    @Test
    void shouldRecoverSameRunningTurnToPending() {
        insertProject("project-1", "user-1", "project-request-1");
        insertSession("session-1", "project-1", "user-1");
        insertTurn(
                "turn-1",
                "session-1",
                "turn-request-1",
                TurnStatusEnum.RUNNING,
                LocalDateTime.of(2026, 9, 22, 10, 0));

        jdbcTemplate.update(
                """
                UPDATE yak_turn
                SET input_tokens = 10,
                    output_tokens = 5,
                    total_tokens = 15,
                    provider_request_id = 'provider-request-1',
                    finish_reason = 'stop',
                    error_message = 'old error'
                WHERE id = 'turn-1'
                """);

        int recovered = turnRepository.updateRunningTurnPending("turn-1");
        TurnEntity persisted = turnRepository.queryById("turn-1").orElseThrow();

        assertThat(recovered).isEqualTo(1);
        assertThat(persisted.getId()).isEqualTo("turn-1");
        assertThat(persisted.getRequestId()).isEqualTo("turn-request-1");
        assertThat(persisted.getStatus()).isEqualTo(TurnStatusEnum.PENDING);
        assertThat(persisted.getProvider()).isEqualTo("deepseek");
        assertThat(persisted.getModel()).isEqualTo("deepseek-flash");
        assertThat(persisted.getStartedAt()).isNull();
        assertThat(persisted.getFinishedAt()).isNull();
        assertThat(persisted.getInputTokens()).isNull();
        assertThat(persisted.getOutputTokens()).isNull();
        assertThat(persisted.getTotalTokens()).isNull();
        assertThat(persisted.getProviderRequestId()).isNull();
        assertThat(persisted.getFinishReason()).isNull();
        assertThat(persisted.getErrorMessage()).isNull();
    }

    private void insertProject(String projectId, String userId, String requestId) {
        jdbcTemplate.update(
                """
                INSERT INTO yak_project (
                    id, name, request_id,
                    create_time, update_time, create_by, update_by
                )
                VALUES (?, ?, ?, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), ?, ?)
                """,
                projectId,
                projectId,
                requestId,
                userId,
                userId);
    }

    private void insertSession(String sessionId, String projectId, String userId) {
        jdbcTemplate.update(
                """
                INSERT INTO yak_session (
                    id, project_id, title, provider, model, activity_time,
                    create_time, update_time, create_by, update_by
                )
                VALUES (
                    ?, ?, ?, 'deepseek', 'deepseek-flash', CURRENT_TIMESTAMP(6),
                    CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), ?, ?
                )
                """,
                sessionId,
                projectId,
                sessionId,
                userId,
                userId);
    }

    private void insertMessage(
            String messageId,
            String sessionId,
            String turnId,
            MessageRoleEnum role,
            String content,
            long sequence) {
        jdbcTemplate.update(
                """
                INSERT INTO yak_message (
                    id, session_id, turn_id, role, content, message_sequence,
                    create_time, update_time, create_by, update_by
                )
                VALUES (
                    ?, ?, ?, ?, ?, ?,
                    CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), 'user-1', 'user-1'
                )
                """,
                messageId,
                sessionId,
                turnId,
                role.getValue(),
                content,
                sequence);
    }

    private void insertTurn(
            String turnId,
            String sessionId,
            String requestId,
            TurnStatusEnum status,
            LocalDateTime startedAt) {
        jdbcTemplate.update(
                """
                INSERT INTO yak_turn (
                    id, session_id, request_id, turn_type, status, attempt_count,
                    provider, model, started_at,
                    create_time, update_time, create_by, update_by
                )
                VALUES (
                    ?, ?, ?, ?, ?, 1,
                    'deepseek', 'deepseek-flash', ?,
                    CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), 'user-1', 'user-1'
                )
                """,
                turnId,
                sessionId,
                requestId,
                TurnTypeEnum.CHAT.getValue(),
                status.getValue(),
                startedAt);
    }
}
