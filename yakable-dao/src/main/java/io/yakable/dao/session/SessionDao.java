package io.yakable.dao.session;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import io.yakable.dao.session.mapper.SessionMapper;
import io.yakable.dao.session.model.SessionPO;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Repository;

import java.util.Objects;
import java.util.Optional;

@Repository
@DependsOn("yakableFlyway")
public class SessionDao {

    private final SessionMapper mapper;

    public SessionDao(SessionMapper mapper) {
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    public SessionPO save(SessionPO session) {
        Objects.requireNonNull(session, "session");
        if (mapper.selectById(session.getId()) == null) {
            mapper.insert(session);
        } else {
            mapper.updateById(session);
        }
        return session;
    }

    public Optional<SessionPO> findById(String sessionId) {
        return Optional.ofNullable(mapper.selectById(sessionId));
    }

    public Optional<SessionPO> findOwned(
            String projectId,
            String sessionId
    ) {
        return Optional.ofNullable(
                mapper.selectOne(
                        Wrappers.<SessionPO>lambdaQuery()
                                .eq(SessionPO::getId, sessionId)
                                .eq(SessionPO::getProjectId, projectId)
                )
        );
    }

    public Optional<SessionPO> lockById(String sessionId) {
        return Optional.ofNullable(
                mapper.selectOne(
                        Wrappers.<SessionPO>lambdaQuery()
                                .eq(SessionPO::getId, sessionId)
                                .last("FOR UPDATE")
                )
        );
    }
}
