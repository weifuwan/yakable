package io.yakable.boot;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "io.yakable")
public class YakableApplication {

    public static void main(String[] args) {
        SpringApplication.run(YakableApplication.class, args);
    }
}
