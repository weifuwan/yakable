package io.yakable.boot.configuration.security;

import io.yakable.service.auth.AuthService;
import jakarta.servlet.DispatcherType;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = SecurityConfigurationTest.TestController.class)
@AutoConfigureMockMvc
@Import({
        SecurityConfiguration.class,
        AuthSessionAuthenticationFilter.class,
        CsrfCookieFilter.class,
        SecurityConfigurationTest.TestController.class
})
class SecurityConfigurationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuthService authService;

    @Test
    void shouldRequireAuthenticationForNormalRequest() throws Exception {
        mockMvc.perform(get("/test/security"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void shouldAllowAsyncDispatcherWithoutReauthorizingCommittedStream() throws Exception {
        mockMvc.perform(get("/test/security").with(dispatcherType(DispatcherType.ASYNC)))
                .andExpect(status().isOk())
                .andExpect(content().string("ok"));
    }

    @Test
    void shouldAllowErrorDispatcherWithoutReauthorizingCommittedResponse() throws Exception {
        mockMvc.perform(get("/test/security").with(dispatcherType(DispatcherType.ERROR)))
                .andExpect(status().isOk())
                .andExpect(content().string("ok"));
    }

    private static RequestPostProcessor dispatcherType(DispatcherType dispatcherType) {
        return request -> {
            request.setDispatcherType(dispatcherType);
            return request;
        };
    }

    @RestController
    public static class TestController {

        @GetMapping("/test/security")
        String security() {
            return "ok";
        }
    }
}
