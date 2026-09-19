package io.yakable.dao.session;

import io.yakable.dao.session.mapper.SessionMapper;
import io.yakable.dao.session.model.SessionPO;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Repository;

import java.util.Objects;
import java.util.Optional;

@Repository
@DependsOn("yakableFlyway")
public class MybatisSessionDao implements SessionDao {

    private final SessionMapper mapper;

    public MybatisSessionDao(SessionMapper mapper) {
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    @Override
    public SessionPO save(SessionPO session) {
        Objects.requireNonNull(session, "session");
        if (mapper.selectById(session.getId()) == null) {
            mapper.insert(session);
        } else {
            mapper.updateById(session);
        }
        return session;
    }

    @Override
    public Optional<SessionPO> findById(String sessionId) {
        return Optional.ofNullable(mapper.selectById(sessionId));
    }

    @Override
    public Optional<SessionPO> lockById(String sessionId) {
        return Optional.ofNullable(
                mapper.selectByIdForUpdate(sessionId)
        );
    }
}
