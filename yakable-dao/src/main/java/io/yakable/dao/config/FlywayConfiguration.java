package io.yakable.dao.config;

import org.flywaydb.core.Flyway;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;

/**
 * Flyway 配置。
 */
@Configuration(proxyBeanMethods = false)
public class FlywayConfiguration {

    @Bean(name = "yakableFlyway", initMethod = "migrate")
    Flyway yakableFlyway(DataSource dataSource) {
        return Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration/yakable")
                .table("yakable_schema_history")
                .load();
    }
}
