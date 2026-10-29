package com.dailo.app.service;

import com.dailo.app.dto.TimeBoxBlockDto;
import com.dailo.app.entity.TimeBoxBlock;
import com.dailo.app.repository.TimeBoxBlockRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TimeBoxBlockService {

    private final TimeBoxBlockRepository blockRepository;

    public List<TimeBoxBlockDto.Response> findByDate(Long memberId, LocalDate date) {
        return blockRepository.findByMemberIdAndPlanDateOrderByStartHourAscStartSlotAsc(memberId, date)
                .stream().map(TimeBoxBlockDto.Response::from).collect(Collectors.toList());
    }

    @Transactional
    public TimeBoxBlockDto.Response create(Long memberId, TimeBoxBlockDto.Request req) {
        TimeBoxBlock block = TimeBoxBlock.builder()
                .memberId(memberId)
                .planDate(req.getPlanDate())
                .startHour(req.getStartHour())
                .startSlot(req.getStartSlot())
                .endHour(req.getEndHour())
                .endSlot(req.getEndSlot())
                .content(req.getContent() != null ? req.getContent() : "")
                .isDone(false)
                .build();
        return TimeBoxBlockDto.Response.from(blockRepository.save(block));
    }

    @Transactional
    public TimeBoxBlockDto.Response update(Long memberId, Long id, TimeBoxBlockDto.Request req) {
        TimeBoxBlock block = findOwned(memberId, id);
        block.update(req.getContent(), req.getIsDone());
        return TimeBoxBlockDto.Response.from(block);
    }

    @Transactional
    public void delete(Long memberId, Long id) {
        blockRepository.delete(findOwned(memberId, id));
    }

    private TimeBoxBlock findOwned(Long memberId, Long id) {
        TimeBoxBlock block = blockRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("블록을 찾을 수 없습니다: " + id));
        // 다른 회원의 블록 수정·삭제 방지 (IDOR)
        if (!block.getMemberId().equals(memberId)) {
            throw new IllegalArgumentException("블록을 찾을 수 없습니다: " + id);
        }
        return block;
    }
}
