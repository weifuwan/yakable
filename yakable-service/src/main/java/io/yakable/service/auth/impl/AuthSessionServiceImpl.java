package io.yakable.service.auth.impl;

import io.yakable.common.bean.dto.auth.AddAuthSessionDTO;
import io.yakable.common.bean.dto.auth.AuthTokenDTO;
import io.yakable.common.bean.dto.auth.RevokeUserSessionsDTO;
import io.yakable.common.bean.vo.auth.AuthSessionVO;
import io.yakable.common.constant.SystemConstant;
import io.yakable.common.enums.auth.AuthErrorCode;
import io.yakable.common.exception.AuthException;
import io.yakable.common.utils.DateUtils;
import io.yakable.dao.entity.AuthSessionEntity;
import io.yakable.dao.repository.AuthSessionRepository;
import io.yakable.service.auth.AuthSessionService;
import jakarta.annotation.Resource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.validation.annotation.Validated;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;

@Service
@Validated
public class AuthSessionServiceImpl implements AuthSessionService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    @Resource
    private AuthSessionRepository authSessionRepository;

    @Value("${yakable.auth.session-ttl-seconds:604800}")
    private long sessionTtlSeconds;

    @Override
    public AuthSessionVO addAuthSession(AddAuthSessionDTO dto) {
        String token = newToken();
        LocalDateTime expiresAt = DateUtils.now().plusSeconds(sessionTtlSeconds);

        AuthSessionEntity session = new AuthSessionEntity();
        session.initCreate(dto.userId());
        session.setUserId(dto.userId());
        session.setTokenHash(hashToken(token));
        session.setExpiresAt(expiresAt);
        authSessionRepository.add(session);

        AuthSessionVO result = new AuthSessionVO();
        result.setUserId(dto.userId());
        result.setSessionToken(token);
        result.setExpiresAt(expiresAt);
        return result;
    }

    @Override
    public AuthSessionVO queryAuthSession(AuthTokenDTO dto) {
        AuthSessionEntity session = authSessionRepository.queryAuthSessionByTokenHash(hashToken(dto.token()), DateUtils.now());
        if (session == null) {
            throw new AuthException(AuthErrorCode.UNAUTHORIZED);
        }
        AuthSessionVO result = new AuthSessionVO();
        result.setUserId(session.getUserId());
        result.setExpiresAt(session.getExpiresAt());
        return result;
    }

    @Override
    public void revokeAuthSession(AuthTokenDTO dto) {
        authSessionRepository.updateRevokeAuthSessionByTokenHash(
                hashToken(dto.token()), DateUtils.now(), SystemConstant.SYSTEM_USER);
    }

    @Override
    public void revokeUserSessions(RevokeUserSessionsDTO dto) {
        authSessionRepository.updateRevokeAuthSessionByUserId(
                dto.userId(), DateUtils.now(), dto.operatorId());
    }

    private static String newToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String hashToken(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }
}
