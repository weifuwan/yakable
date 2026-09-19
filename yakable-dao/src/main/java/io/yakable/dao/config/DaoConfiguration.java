package io.yakable.dao.config;

import org.flywaydb.core.Flyway;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;

@Configuration(proxyBeanMethods = false)
@MapperScan({
        "io.yakable.dao.project.mapper",
        "io.yakable.dao.session.mapper"
})
public class DaoConfiguration {

    @Bean(name = "yakableFlyway", initMethod = "migrate")
    Flyway yakableFlyway(DataSource dataSource) {
        return Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration/yakable")
                .table("yakable_schema_history")
                .load();
    }
}
