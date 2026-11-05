package com.dailo.app.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtUtilTest {

    private static final String SECRET = "test-secret-0123456789-abcdefghijklmnopqrstuvwxyz";

    @Test
    void 비밀키가_없거나_약하면_기동을_막는다() {
        assertThatThrownBy(() -> new JwtUtil(null)).isInstanceOf(IllegalStateException.class).hasMessageContaining("설정되지 않았");
        assertThatThrownBy(() -> new JwtUtil("  ")).isInstanceOf(IllegalStateException.class).hasMessageContaining("JWT_SECRET");
        assertThatThrownBy(() -> new JwtUtil("short-secret")).isInstanceOf(IllegalStateException.class).hasMessageContaining("짧습니다");
    }

    @Test
    void 저장소에_공개된_예전_기본값은_거절한다() {
        String leaked = JwtUtil.LEAKED_SECRETS.iterator().next();
        assertThatThrownBy(() -> new JwtUtil(leaked)).isInstanceOf(IllegalStateException.class).hasMessageContaining("공개된");
    }

    @Test
    void 발급한_토큰은_검증되고_회원_정보를_돌려준다() {
        JwtUtil jwt = new JwtUtil(SECRET);
        String token = jwt.generateToken(7L, "dailo_user");
        assertThat(jwt.validateToken(token)).isTrue();
        assertThat(jwt.getMemberId(token)).isEqualTo(7L);
        assertThat(jwt.getUsername(token)).isEqualTo("dailo_user");
    }

    @Test
    void 다른_키로_위조한_토큰은_거절한다() {
        JwtUtil jwt = new JwtUtil(SECRET);
        String leaked = JwtUtil.LEAKED_SECRETS.iterator().next();
        String forged = Jwts.builder().subject("admin").claim("memberId", 1L)
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(Keys.hmacShaKeyFor(leaked.getBytes(StandardCharsets.UTF_8))).compact();
        assertThat(jwt.validateToken(forged)).isFalse();
        assertThat(jwt.validateToken("not-a-token")).isFalse();
    }
}
