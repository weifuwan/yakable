package io.yakable.service.turn.impl;

import io.yakable.common.bean.vo.session.TurnExecutionVO;
import io.yakable.common.bean.vo.session.TurnVO;
import io.yakable.common.enums.session.TurnStatusEnum;
import io.yakable.dao.entity.TurnEntity;
import io.yakable.dao.repository.TurnRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TurnServiceImplTest {

    @Mock
    private TurnRepository turnRepository;

    @InjectMocks
    private TurnServiceImpl turnService;

    @Test
    void shouldCreatePendingTurnWithModelIdentity() {
        TurnVO result = turnService.addTurn("session-1", "kimi", "kimi-k3", "request-1");

        ArgumentCaptor<TurnEntity> captor = ArgumentCaptor.forClass(TurnEntity.class);
        verify(turnRepository).add(captor.capture());

        TurnEntity saved = captor.getValue();
        assertThat(saved.getSessionId()).isEqualTo("session-1");
        assertThat(saved.getRequestId()).isEqualTo("request-1");
        assertThat(saved.getProvider()).isEqualTo("kimi");
        assertThat(saved.getModel()).isEqualTo("kimi-k3");
        assertThat(saved.getStatus()).isEqualTo(TurnStatusEnum.PENDING);
        assertThat(result.getInvocation().getProvider()).isEqualTo("kimi");
        assertThat(result.getInvocation().getModel()).isEqualTo("kimi-k3");
    }

    @Test
    void shouldExposeTurnModelInExecutionContext() {
        TurnEntity entity = new TurnEntity();
        entity.setId("turn-1");
        entity.setSessionId("session-1");
        entity.setRequestId("request-1");
        entity.setProvider("deepseek");
        entity.setModel("deepseek-flash");
        when(turnRepository.queryById("turn-1")).thenReturn(Optional.of(entity));

        TurnExecutionVO result = turnService.queryTurnExecution("turn-1").orElseThrow();

        assertThat(result.getRequestId()).isEqualTo("request-1");
        assertThat(result.getProvider()).isEqualTo("deepseek");
        assertThat(result.getModel()).isEqualTo("deepseek-flash");
    }

    @Test
    void shouldRecoverSpecificRunningTurnToPending() {
        when(turnRepository.updateRunningTurnPending("turn-1")).thenReturn(1);

        assertThat(turnService.updateRunningTurnPending("turn-1")).isEqualTo(1);

        verify(turnRepository).updateRunningTurnPending("turn-1");
    }

    @Test
    void shouldClaimPendingTurnWithoutChangingModelIdentity() {
        LocalDateTime claimedAt = LocalDateTime.of(2026, 9, 22, 9, 0);
        TurnEntity entity = new TurnEntity();
        entity.setId("turn-1");
        entity.setSessionId("session-1");
        entity.setProvider("kimi");
        entity.setModel("kimi-k3");
        entity.setStatus(TurnStatusEnum.RUNNING);
        entity.setAttemptCount(1);
        when(turnRepository.updatePendingTurn("turn-1", claimedAt))
                .thenReturn(Optional.of(entity));

        TurnVO result = turnService.updatePendingTurn("turn-1", claimedAt).orElseThrow();

        verify(turnRepository).updatePendingTurn("turn-1", claimedAt);
        assertThat(result.getInvocation().getProvider()).isEqualTo("kimi");
        assertThat(result.getInvocation().getModel()).isEqualTo("kimi-k3");
    }
}
