---
title: "plan-and-apply"
source_type: local
repo_url: ""
local_path: "/Users/wangbin/workspace/mind-notes/03 🛠️ [Skills]/local/plan-and-apply"
install: "复制本目录下的 SKILL.md 到目标智能体的 skills 目录"
use_case: "非平凡开发任务的先规划后实施工作流"
related: ["AGENTS.md", "lessons.md", "planning-with-files"]
created: 2026-06-01
updated: 2026-06-01
---

# 简介

这个本地 skill 用来固化“先读规则、先分析、先规划、最小切片实施、改后验证、最后收口”的执行闭环。

# 本地路径与依赖

- 路径（skill 文件夹）：`/Users/wangbin/workspace/mind-notes/03 🛠️ [Skills]/local/plan-and-apply`
- 运行环境：通用 Codex / Claude 类技能环境
- 依赖：无硬依赖；复杂任务建议配合 `task_plan.md`、`findings.md`、`progress.md`

# 使用方法

- `SKILL.md`：主技能说明
- 入口命令：无
- 常见任务：
  - 先规划再实施
  - 多文件闭环实现
  - 迁移、重构、模块拆分
  - 强验证和回归收口
- 测试样例：`evals/evals.json`
- 输出结果：一套稳定的执行节奏和边界控制方式

# 备注

- 维护人：wangbin
- 更新频率：按复盘结果迭代
