package io.yakable.dao.project.mapper;

import io.yakable.dao.project.model.ProjectQueryRow;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface ProjectQueryMapper {

    @Select("""
            SELECT
                p.id,
                p.name,
                s.id AS latest_session_id,
                p.status,
                p.created_at,
                CASE
                    WHEN p.updated_at >= s.updated_at
                        THEN p.updated_at
                    ELSE s.updated_at
                END AS updated_at
            FROM yak_project p
            JOIN (
                SELECT id, project_id, updated_at
                FROM (
                    SELECT
                        id,
                        project_id,
                        updated_at,
                        ROW_NUMBER() OVER (
                            PARTITION BY project_id
                            ORDER BY updated_at DESC, id DESC
                        ) AS rn
                    FROM yak_session
                ) ranked_session
                WHERE rn = 1
            ) s ON s.project_id = p.id
            ORDER BY updated_at DESC, p.id DESC
            LIMIT #{limit}
            OFFSET #{offset}
            """)
    List<ProjectQueryRow> selectProjectPage(
            @Param("offset") long offset,
            @Param("limit") int limit
    );

    @Select("""
            SELECT COUNT(*)
            FROM yak_project p
            WHERE EXISTS (
                SELECT 1
                FROM yak_session s
                WHERE s.project_id = p.id
            )
            """)
    long countProjectsWithSession();

    @Select("""
            SELECT
                p.id,
                p.name,
                s.id AS latest_session_id,
                p.status,
                p.created_at,
                CASE
                    WHEN p.updated_at >= s.updated_at
                        THEN p.updated_at
                    ELSE s.updated_at
                END AS updated_at
            FROM yak_project p
            JOIN (
                SELECT id, project_id, updated_at
                FROM (
                    SELECT
                        id,
                        project_id,
                        updated_at,
                        ROW_NUMBER() OVER (
                            PARTITION BY project_id
                            ORDER BY updated_at DESC, id DESC
                        ) AS rn
                    FROM yak_session
                    WHERE project_id = #{projectId}
                ) ranked_session
                WHERE rn = 1
            ) s ON s.project_id = p.id
            WHERE p.id = #{projectId}
            """)
    ProjectQueryRow selectProjectDetails(
            @Param("projectId") String projectId
    );
}
