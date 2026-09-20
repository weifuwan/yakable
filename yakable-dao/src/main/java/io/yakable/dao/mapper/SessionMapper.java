package io.yakable.dao.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import io.yakable.dao.entity.SessionEntity;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface SessionMapper extends BaseMapper<SessionEntity> {

    List<SessionEntity> selectLatestByProjectIds(@Param("projectIds") List<String> projectIds);
}
