package io.yakable.boot.configuration.auth;

import io.yakable.common.bean.dto.user.InitializeAdminDTO;
import io.yakable.service.user.UserService;
import jakarta.annotation.Resource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class InitialAdminInitializer implements ApplicationRunner {

    @Resource
    private UserService userService;

    @Value("${yakable.auth.initial-admin.username:}")
    private String username;

    @Value("${yakable.auth.initial-admin.name:}")
    private String name;

    @Value("${yakable.auth.initial-admin.password:}")
    private String password;

    @Override
    public void run(ApplicationArguments args) {
        boolean hasUsername = username != null && !username.isBlank();
        boolean hasPassword = password != null && !password.isBlank();
        if (!hasUsername && !hasPassword) {
            return;
        }
        if (!hasUsername || !hasPassword) {
            throw new IllegalStateException("Initial administrator requires both username and password");
        }
        String displayName = name == null || name.isBlank() ? username : name;
        userService.initializeAdmin(new InitializeAdminDTO(username, displayName, password));
    }
}
