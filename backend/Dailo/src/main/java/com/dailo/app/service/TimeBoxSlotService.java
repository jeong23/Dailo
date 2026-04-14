package com.dailo.app.service;

import com.dailo.app.dto.TimeBoxSlotDto;
import com.dailo.app.entity.TimeBoxSlot;
import com.dailo.app.repository.TimeBoxSlotRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TimeBoxSlotService {

    private final TimeBoxSlotRepository timeBoxSlotRepository;

    public List<TimeBoxSlotDto.Response> findByDate(LocalDate date) {
        return timeBoxSlotRepository.findByPlanDateOrderByHourAsc(date).stream()
                .map(TimeBoxSlotDto.Response::from)
                .collect(Collectors.toList());
    }

    @Transactional
    public TimeBoxSlotDto.Response upsert(TimeBoxSlotDto.Request request) {
        Optional<TimeBoxSlot> existing = timeBoxSlotRepository
                .findByPlanDateAndHour(request.getPlanDate(), request.getHour());

        if (existing.isPresent()) {
            TimeBoxSlot slot = existing.get();
            slot.update(request.getSlot1(), request.getSlot2(), request.getSlot1Done(), request.getSlot2Done());
            return TimeBoxSlotDto.Response.from(slot);
        }

        TimeBoxSlot slot = TimeBoxSlot.builder()
                .planDate(request.getPlanDate())
                .hour(request.getHour())
                .slot1(request.getSlot1())
                .slot2(request.getSlot2())
                .slot1Done(request.getSlot1Done() != null ? request.getSlot1Done() : false)
                .slot2Done(request.getSlot2Done() != null ? request.getSlot2Done() : false)
                .build();
        return TimeBoxSlotDto.Response.from(timeBoxSlotRepository.save(slot));
    }
}
