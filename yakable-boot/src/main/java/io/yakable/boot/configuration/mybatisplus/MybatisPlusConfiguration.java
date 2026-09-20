package io.yakable.boot.configuration.mybatisplus;

import com.baomidou.mybatisplus.annotation.DbType;
import com.baomidou.mybatisplus.autoconfigure.MybatisPlusPropertiesCustomizer;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.config.GlobalConfig;
import com.baomidou.mybatisplus.core.toolkit.GlobalConfigUtils;
import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.PaginationInnerInterceptor;
import org.apache.ibatis.type.JdbcType;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * MyBatis-Plus 配置。
 */
@Configuration(proxyBeanMethods = false)
@MapperScan("io.yakable.dao.mapper")
public class MybatisPlusConfiguration {

    private static final long MAX_PAGE_SIZE = 500L;

    @Bean
    MybatisPlusInterceptor mybatisPlusInterceptor() {
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
        interceptor.addInnerInterceptor(paginationInterceptor());
        return interceptor;
    }

    @Bean
    MybatisPlusPropertiesCustomizer mybatisPlusPropertiesCustomizer() {
        return properties -> {
            MybatisConfiguration configuration = new MybatisConfiguration();
            configuration.setJdbcTypeForNull(JdbcType.NULL);
            configuration.setMapUnderscoreToCamelCase(true);
            properties.setConfiguration(configuration);
            properties.setMapperLocations(new String[]{"classpath*:/mapper/**/*.xml"});

            GlobalConfig globalConfig = GlobalConfigUtils.getGlobalConfig(configuration);
            globalConfig.setBanner(false);
            properties.setGlobalConfig(globalConfig);
        };
    }

    private PaginationInnerInterceptor paginationInterceptor() {
        PaginationInnerInterceptor pagination = new PaginationInnerInterceptor(DbType.MYSQL);
        pagination.setOverflow(false);
        pagination.setMaxLimit(MAX_PAGE_SIZE);
        return pagination;
    }
}
