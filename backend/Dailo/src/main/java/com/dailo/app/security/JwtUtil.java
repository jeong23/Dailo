package com.dailo.app.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Set;

@Component
public class JwtUtil {

    // 1시간 — 사용 중에는 프론트가 /api/auth/refresh로 계속 연장, 1시간 동안 아무 요청 없으면 만료되어 로그아웃
    public static final long EXPIRATION_MS = 60L * 60 * 1000;

    static final int MIN_SECRET_BYTES = 32; // HS256 최소 키 길이

    // 예전 코드 기본값 — public 저장소에 공개돼 있어 이 값으로 서명하면 누구나 토큰을 위조할 수 있음
    static final Set<String> LEAKED_SECRETS = Set.of("dailo-jwt-secret-key-must-be-at-least-32-characters-long");

    private final SecretKey key;

    // 비밀키는 기본값 없음 — 환경변수 JWT_SECRET 또는 application.yml jwt.secret 필수 (없거나 약하면 기동 실패)
    public JwtUtil(@Value("${jwt.secret:}") String secret) {
        this.key = Keys.hmacShaKeyFor(checkSecret(secret).getBytes(StandardCharsets.UTF_8));
    }

    static String checkSecret(String secret) {
        String s = secret == null ? "" : secret.trim();
        String how = " — 환경변수 JWT_SECRET 또는 application.yml jwt.secret에 무작위 문자열(32바이트 이상)을 넣으세요. 예: openssl rand -base64 48";
        if (s.isEmpty()) throw new IllegalStateException("JWT 비밀키가 설정되지 않았습니다" + how);
        if (LEAKED_SECRETS.contains(s)) throw new IllegalStateException("공개된 예전 기본 JWT 비밀키는 쓸 수 없습니다" + how);
        if (s.getBytes(StandardCharsets.UTF_8).length < MIN_SECRET_BYTES) {
            throw new IllegalStateException("JWT 비밀키가 너무 짧습니다(" + MIN_SECRET_BYTES + "바이트 이상)" + how);
        }
        return s;
    }

    public String generateToken(Long memberId, String username) {
        return Jwts.builder()
                .subject(username)
                .claim("memberId", memberId)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + EXPIRATION_MS))
                .signWith(key)
                .compact();
    }

    public boolean validateToken(String token) {
        try {
            Jwts.parser().verifyWith(key).build().parseSignedClaims(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public Long getMemberId(String token) {
        return Jwts.parser().verifyWith(key).build()
                .parseSignedClaims(token).getPayload()
                .get("memberId", Long.class);
    }

    public String getUsername(String token) {
        return Jwts.parser().verifyWith(key).build()
                .parseSignedClaims(token).getPayload()
                .getSubject();
    }
}
