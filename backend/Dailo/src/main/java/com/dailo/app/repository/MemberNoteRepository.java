package com.dailo.app.repository;

import com.dailo.app.entity.MemberNote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MemberNoteRepository extends JpaRepository<MemberNote, Long> {
    Optional<MemberNote> findByMemberIdAndNoteKey(Long memberId, String noteKey);
}
