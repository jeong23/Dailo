package com.dailo.app.service;

import com.dailo.app.dto.MemberRequestDto;
import com.dailo.app.entity.Member;
import com.dailo.app.repository.MemberRepository;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

// 회원가입 입력 검증 — 프론트를 거치지 않고 API를 직접 불러도 같은 규칙
class MemberSignupTest {

    private final MemberRepository repo = mock(MemberRepository.class);
    private final PasswordEncoder encoder = mock(PasswordEncoder.class);
    private final MemberService service = new MemberService(repo, encoder);

    private static MemberRequestDto req(String username, String password, String name, Integer salaryDay) {
        return MemberRequestDto.builder().username(username).password(password).name(name).salaryDay(salaryDay).role("ADMIN").build();
    }

    @Test
    void 정상_가입은_아이디를_소문자로_저장하고_USER로_만든다() {
        when(encoder.encode("abcd1234")).thenReturn("hashed");
        when(repo.save(any(Member.class))).thenAnswer(inv -> inv.getArgument(0));

        service.create(req("  Dailo_01 ", "abcd1234", " 홍길동 ", null));

        verify(repo).save(argThat(m -> m.getUsername().equals("dailo_01") && m.getName().equals("홍길동")
                && m.getRole().equals("USER") && m.getPassword().equals("hashed") && m.getSalaryDay() == 25));
    }

    @Test
    void 규칙에_안_맞는_입력은_거부한다() {
        assertThatThrownBy(() -> service.create(req("ab", "abcd1234", "이름", 25))).hasMessageContaining("아이디");
        assertThatThrownBy(() -> service.create(req("한글아이디", "abcd1234", "이름", 25))).hasMessageContaining("아이디");
        assertThatThrownBy(() -> service.create(req("dailo", "12345678", "이름", 25))).hasMessageContaining("비밀번호");
        assertThatThrownBy(() -> service.create(req("dailo", "abc12", "이름", 25))).hasMessageContaining("비밀번호");
        assertThatThrownBy(() -> service.create(req("dailo", "abcd1234", "  ", 25))).hasMessageContaining("이름");
        assertThatThrownBy(() -> service.create(req("dailo", "abcd1234", "이름", 32))).hasMessageContaining("월급일");
        verify(repo, never()).save(any());
    }

    @Test
    void 이미_있는_아이디는_거부한다() {
        when(repo.existsByUsername("dailo")).thenReturn(true);
        assertThatThrownBy(() -> service.create(req("Dailo", "abcd1234", "이름", 25))).hasMessageContaining("이미 사용 중");
    }
}
