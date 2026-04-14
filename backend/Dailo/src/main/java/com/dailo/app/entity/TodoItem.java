package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "todo_item")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class TodoItem extends BaseEntity {

    @Column(nullable = false)
    private LocalDate planDate;

    @Column(nullable = false, length = 200)
    private String content;

    // BRAIN_DUMP, BIG3
    @Column(nullable = false, length = 20)
    private String type;

    @Column(nullable = false)
    private Boolean isDone;

    private Integer sortOrder;

    public void update(String content, Boolean isDone) {
        this.content = content;
        this.isDone = isDone;
    }

    public void toggleDone() {
        this.isDone = !this.isDone;
    }
}
