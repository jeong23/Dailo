package com.dailo.app.service;

import com.dailo.app.entity.MemberNote;
import com.dailo.app.repository.MemberNoteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MemberNoteService {

    // 허용 키: 용도-YYYY-MM — 아무 키나 받으면 저장소처럼 남용될 수 있어 형식 제한
    static final Pattern KEY = Pattern.compile("(budget|planner)-\\d{4}-(0[1-9]|1[0-2])");
    static final int MAX_LENGTH = 5000;

    private final MemberNoteRepository noteRepo;

    public String get(Long memberId, String key) {
        check(key);
        return noteRepo.findByMemberIdAndNoteKey(memberId, key).map(MemberNote::getContent).orElse("");
    }

    // 빈 내용이면 지움 — 메모 없는 달마다 빈 로우가 쌓이지 않게
    @Transactional
    public void save(Long memberId, String key, String content) {
        check(key);
        String text = content == null ? "" : content;
        if (text.length() > MAX_LENGTH) throw new IllegalArgumentException("메모는 " + MAX_LENGTH + "자 이내로 입력해주세요");
        var existing = noteRepo.findByMemberIdAndNoteKey(memberId, key);
        if (text.isBlank()) {
            existing.ifPresent(noteRepo::delete);
        } else if (existing.isPresent()) {
            existing.get().update(text);
        } else {
            noteRepo.save(MemberNote.builder().memberId(memberId).noteKey(key).content(text).build());
        }
    }

    private static void check(String key) {
        if (key == null || !KEY.matcher(key).matches()) throw new IllegalArgumentException("메모 키 형식이 올바르지 않습니다");
    }
}
