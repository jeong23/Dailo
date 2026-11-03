package com.dailo.app.service;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

// 탈퇴 회원 삭제: 회원 데이터 테이블을 하나라도 빠뜨리면 고아 데이터(개인정보)가 남는다
class MemberPurgeServiceTest {

    private static final Set<String> SHARED_TABLES = Set.of("member", "category"); // 회원 소유 아님

    @Test
    void 모든_엔티티_테이블이_삭제_목록에_있다() throws Exception {
        Set<String> covered = MemberPurgeService.CHILD_TABLES.stream().map(c -> c[0]).collect(Collectors.toSet());
        covered.addAll(MemberPurgeService.MEMBER_TABLES);

        List<String> missing = new ArrayList<>();
        List<String> memberOwnedButChild = new ArrayList<>();
        for (Class<?> entity : entities()) {
            String table = entity.getAnnotation(Table.class).name();
            if (SHARED_TABLES.contains(table)) continue;
            if (!covered.contains(table)) missing.add(table);
            if (hasMemberLink(entity) && !MemberPurgeService.MEMBER_TABLES.contains(table)) memberOwnedButChild.add(table);
        }
        assertThat(missing).as("MemberPurgeService에 없는 테이블").isEmpty();
        assertThat(memberOwnedButChild).as("member_id가 있는데 MEMBER_TABLES에 없는 테이블").isEmpty();
    }

    @Test
    void 자식_테이블을_먼저_지우고_회원은_마지막에_지운다() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        new MemberPurgeService(jdbc).purge(7L);

        InOrder order = inOrder(jdbc);
        order.verify(jdbc).update(startsWith("DELETE FROM invest_monthly_record"), eq(7L));
        order.verify(jdbc).update(startsWith("DELETE FROM invest_holding"), eq(7L));
        order.verify(jdbc).update(startsWith("DELETE FROM daily_expense"), eq(7L));
        order.verify(jdbc).update(eq("DELETE FROM invest_account WHERE member_id = ?"), eq(7L));
        order.verify(jdbc).update(eq("DELETE FROM monthly_budget WHERE member_id = ?"), eq(7L));
        order.verify(jdbc).update(eq("DELETE FROM member WHERE id = ?"), eq(7L));
    }

    private static List<Class<?>> entities() throws ClassNotFoundException {
        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(Entity.class));
        List<Class<?>> result = new ArrayList<>();
        for (BeanDefinition bd : scanner.findCandidateComponents("com.dailo.app.entity")) {
            result.add(Class.forName(bd.getBeanClassName()));
        }
        assertThat(result).hasSizeGreaterThan(20);
        return result;
    }

    private static boolean hasMemberLink(Class<?> entity) {
        for (var f : entity.getDeclaredFields()) {
            if (f.getName().equals("memberId") || f.getType().getSimpleName().equals("Member")) return true;
        }
        return false;
    }
}
