package io.yakable.service.message.impl;

import io.yakable.common.constant.MessageConstant;
import io.yakable.common.enums.session.MessageRoleEnum;
import io.yakable.common.enums.session.SessionErrorCode;
import io.yakable.common.exception.SessionException;
import io.yakable.dao.entity.MessageEntity;
import io.yakable.dao.repository.MessageRepository;
import io.yakable.service.observability.ConversationMetrics;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MessageServiceImplTest {

    @Mock
    private MessageRepository messageRepository;

    @Mock
    private ConversationMetrics conversationMetrics;

    @InjectMocks
    private MessageServiceImpl messageService;

    @Test
    void shouldPersistNormalMessage() {
        when(messageRepository.queryNextMessageSequence("session-1")).thenReturn(1L);

        messageService.addMessage("session-1", "turn-1", MessageRoleEnum.USER, "Hello");

        ArgumentCaptor<MessageEntity> captor = ArgumentCaptor.forClass(MessageEntity.class);
        verify(messageRepository).add(captor.capture());
        assertThat(captor.getValue().getContent()).isEqualTo("Hello");
        assertThat(captor.getValue().getMessageSequence()).isEqualTo(1L);
    }

    @Test
    void shouldRejectMessageAboveStorageBoundaryBeforeDatabaseWrite() {
        String oversized = "x".repeat(MessageConstant.MAX_CONTENT_LENGTH + 1);

        assertThatThrownBy(() ->
                messageService.addMessage("session-1", "turn-1", MessageRoleEnum.ASSISTANT, oversized))
                .isInstanceOf(SessionException.class)
                .satisfies(exception ->
                        assertThat(((SessionException) exception).getErrorCode())
                                .isEqualTo(SessionErrorCode.MESSAGE_TOO_LARGE));

        verify(conversationMetrics).messageTooLarge();
        verify(messageRepository, never()).queryNextMessageSequence("session-1");
        verify(messageRepository, never()).add(org.mockito.ArgumentMatchers.any());
    }
}
