package com.dailo.app.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
public class SpaController {

    @RequestMapping(value = {"/", "/expenses", "/fixed-costs", "/report", "/emergency", "/settings", "/todo", "/planner-board", "/running", "/habits", "/login", "/invest", "/invest/settings", "/invest/diary", "/invest/analytics"})
    public String forward() {
        return "forward:/index.html";
    }
}
