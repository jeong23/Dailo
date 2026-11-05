package com.dailo.app.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

// 더 이상 아무 데서도 안 쓰는 업로드 사진 파일을 저장소(로컬·R2)에서 지운다.
// - 참조 확인은 회원 구분 없이 전체 행 기준: 보드 사진 주소는 사용자가 보낼 수 있어서(다른 회원 주소를 넣고 지우는 공격),
//   어딘가에서 아직 쓰고 있으면 지우지 않는다
// - 파일 삭제는 DB 커밋 뒤에만 — 롤백되면 행은 남았는데 파일만 사라지는 일이 없게
// 새로 이미지 주소 컬럼을 만들면 REFERENCES에 추가
@Slf4j
@Service
@RequiredArgsConstructor
public class ImageCleanupService {

    // 업로드 사진 주소를 담는 컬럼 {테이블, 컬럼}
    static final List<String[]> REFERENCES = List.of(
            new String[]{"vision_board_item", "image_url"},
            new String[]{"daily_plan", "future_vision_url"}
    );

    private final JdbcTemplate jdbc;
    private final LocalImageStorage localImageStorage;
    private final R2UploadService r2UploadService;

    // 호출하는 트랜잭션 안에서 행을 지운 뒤 부르면, 남은 참조가 없는 주소만 커밋 후 삭제
    public void deleteUnreferencedAfterCommit(Collection<String> urls) {
        Set<String> orphans = new LinkedHashSet<>();
        for (String url : urls) {
            if (url == null || url.isBlank() || !isOurs(url)) continue;
            if (referenceCount(url) == 0) orphans.add(url);
        }
        if (orphans.isEmpty()) return;
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    orphans.forEach(ImageCleanupService.this::deleteFile);
                }
            });
        } else {
            orphans.forEach(this::deleteFile);
        }
    }

    long referenceCount(String url) {
        long n = 0;
        for (String[] r : REFERENCES) {
            Long c = jdbc.queryForObject("SELECT COUNT(*) FROM " + r[0] + " WHERE " + r[1] + " = ?", Long.class, url);
            n += c == null ? 0 : c;
        }
        return n;
    }

    // 우리 저장소 주소만 — 외부 https 주소는 지울 대상 아님
    boolean isOurs(String url) {
        return url.startsWith(LocalImageStorage.URL_PREFIX) || r2UploadService.owns(url);
    }

    // 파일 삭제 실패는 기록만 (행 삭제·탈퇴 처리는 이미 끝났으므로 되돌리지 않음)
    void deleteFile(String url) {
        try {
            if (url.startsWith(LocalImageStorage.URL_PREFIX)) {
                localImageStorage.delete(url);
            } else if (r2UploadService.owns(url)) {
                r2UploadService.delete(url);
            }
        } catch (Exception e) {
            log.warn("사진 파일 삭제 실패 {} — {}", url, e.getMessage());
        }
    }
}
