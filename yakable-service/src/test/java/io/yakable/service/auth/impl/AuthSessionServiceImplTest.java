package io.yakable.service.auth.impl;

import io.yakable.common.bean.dto.auth.AddAuthSessionDTO;
import io.yakable.common.bean.dto.auth.AuthTokenDTO;
import io.yakable.common.bean.dto.auth.RevokeUserSessionsDTO;
import io.yakable.common.bean.vo.auth.AuthSessionVO;
import io.yakable.common.enums.auth.AuthErrorCode;
import io.yakable.common.exception.AuthException;
import io.yakable.dao.entity.AuthSessionEntity;
import io.yakable.dao.repository.AuthSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthSessionServiceImplTest {

    @Mock
    private AuthSessionRepository authSessionRepository;

    @InjectMocks
    private AuthSessionServiceImpl authSessionService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(authSessionService, "sessionTtlSeconds", 604800L);
    }

    @Test
    void shouldCreateSessionWithoutPersistingRawToken() {
        AuthSessionVO result = authSessionService.addAuthSession(new AddAuthSessionDTO("user-1"));

        ArgumentCaptor<AuthSessionEntity> captor = ArgumentCaptor.forClass(AuthSessionEntity.class);
        verify(authSessionRepository).add(captor.capture());
        AuthSessionEntity session = captor.getValue();

        assertThat(result.getSessionToken()).isNotBlank();
        assertThat(result.getExpiresAt()).isNotNull();
        assertThat(session.getUserId()).isEqualTo("user-1");
        assertThat(session.getTokenHash()).hasSize(64).isNotEqualTo(result.getSessionToken());
    }

    @Test
    void shouldResolveActiveSession() {
        AuthSessionEntity session = new AuthSessionEntity();
        session.setUserId("user-1");
        session.setExpiresAt(LocalDateTime.now().plusDays(1));
        when(authSessionRepository.queryAuthSessionByTokenHash(anyString(), any(LocalDateTime.class))).thenReturn(session);

        AuthSessionVO result = authSessionService.queryAuthSession(new AuthTokenDTO("token"));

        assertThat(result.getUserId()).isEqualTo("user-1");
        assertThat(result.getExpiresAt()).isEqualTo(session.getExpiresAt());
    }

    @Test
    void shouldRejectMissingOrExpiredSession() {
        when(authSessionRepository.queryAuthSessionByTokenHash(anyString(), any(LocalDateTime.class))).thenReturn(null);

        assertThatThrownBy(() -> authSessionService.queryAuthSession(new AuthTokenDTO("token")))
                .isInstanceOf(AuthException.class)
                .satisfies(exception ->
                        assertThat(((AuthException) exception).getErrorCode()).isEqualTo(AuthErrorCode.UNAUTHORIZED));
    }

    @Test
    void shouldRevokeAllUserSessionsWithOperator() {
        authSessionService.revokeUserSessions(new RevokeUserSessionsDTO("user-1", "admin-1"));

        verify(authSessionRepository).updateRevokeAuthSessionByUserId(
                org.mockito.ArgumentMatchers.eq("user-1"),
                any(LocalDateTime.class),
                org.mockito.ArgumentMatchers.eq("admin-1"));
    }
}
