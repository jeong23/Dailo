package com.dailo.app.service;

import com.dailo.app.dto.VisionBoardDto;
import com.dailo.app.entity.VisionBoardItem;
import com.dailo.app.repository.VisionBoardItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class VisionBoardService {

    static final int MAX_ITEMS = 20;
    static final double MIN_SIZE = 5;

    private final VisionBoardItemRepository repository;
    private final ImageCleanupService imageCleanup;

    public List<VisionBoardDto.Response> findAll(Long memberId) {
        return repository.findByMemberIdOrderByZAsc(memberId)
                .stream().map(VisionBoardDto.Response::from).collect(Collectors.toList());
    }

    @Transactional
    public VisionBoardDto.Response create(Long memberId, VisionBoardDto.Request req) {
        String url = req.getImageUrl();
        // 업로드 API가 돌려준 주소만 허용 — 로컬(/uploads/) 또는 R2(https)
        if (url == null || !(url.startsWith(LocalImageStorage.URL_PREFIX) || url.startsWith("https://")) || url.length() > 500) {
            throw new IllegalArgumentException("이미지 주소가 올바르지 않습니다");
        }
        if (repository.countByMemberId(memberId) >= MAX_ITEMS) {
            throw new IllegalArgumentException("사진은 " + MAX_ITEMS + "장까지 올릴 수 있습니다");
        }
        VisionBoardItem item = VisionBoardItem.builder()
                .memberId(memberId)
                .imageUrl(url)
                .x(0d).y(0d).w(40d).h(40d).z(0)
                .build();
        apply(item, req);
        return VisionBoardDto.Response.from(repository.save(item));
    }

    @Transactional
    public VisionBoardDto.Response update(Long memberId, Long id, VisionBoardDto.Request req) {
        VisionBoardItem item = findOwned(memberId, id);
        apply(item, req);
        return VisionBoardDto.Response.from(item);
    }

    @Transactional
    public void delete(Long memberId, Long id) {
        VisionBoardItem item = findOwned(memberId, id);
        repository.delete(item);
        repository.flush(); // 참조 개수 확인이 이 삭제를 보도록
        imageCleanup.deleteUnreferencedAfterCommit(List.of(item.getImageUrl()));
    }

    // 보드 밖으로 나가지 않게 퍼센트 범위로 맞춤 (null이면 기존 값 유지)
    private void apply(VisionBoardItem item, VisionBoardDto.Request req) {
        double w = clamp(or(req.getW(), item.getW()), MIN_SIZE, 100);
        double h = clamp(or(req.getH(), item.getH()), MIN_SIZE, 100);
        double x = clamp(or(req.getX(), item.getX()), 0, 100 - w);
        double y = clamp(or(req.getY(), item.getY()), 0, 100 - h);
        int z = req.getZ() != null ? Math.max(0, req.getZ()) : item.getZ();
        item.moveTo(x, y, w, h, z);
    }

    private static double or(Double v, Double fallback) {
        return v != null && !v.isNaN() ? v : fallback;
    }

    private static double clamp(double v, double min, double max) {
        return Math.max(min, Math.min(max, v));
    }

    private VisionBoardItem findOwned(Long memberId, Long id) {
        VisionBoardItem item = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("사진을 찾을 수 없습니다: " + id));
        // 다른 회원의 사진 이동·삭제 방지 (IDOR)
        if (!item.getMemberId().equals(memberId)) {
            throw new IllegalArgumentException("사진을 찾을 수 없습니다: " + id);
        }
        return item;
    }
}
