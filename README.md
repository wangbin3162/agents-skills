# agents-skills

Claude Code 技能集合。每个技能是一个独立的 `SKILL.md` 定义文件，在 Claude Code 中通过 `/技能名` 调用。

## 安装

### 方式一：npx skills add（推荐）

需要 [Vercel agent-skills CLI](https://github.com/vercel-labs/agent-skills)。

```bash
# 安装全部技能
npx skills add https://github.com/wangbin3162/agents-skills

# 安装单个技能
npx skills add https://github.com/wangbin3162/agents-skills --skill "website-cloner"
```

### 方式二：手动复制

```bash
# 全局可用
cp -r skills/<skill-name> ~/.claude/skills/

# 仅当前项目
cp -r skills/<skill-name> .claude/skills/
```

安装后重启 Claude Code，输入 `/技能名` 即可调用。

## 技能列表

| 技能 | 说明 | 触发方式 |
|------|------|---------|
| [html-prompt-generator](./skills/html-prompt-generator/) | 根据需求概述生成高质量中文 HTML 提示词 | `/html-prompt-generator` |
| [plan-and-apply](./skills/plan-and-apply/) | 复杂任务的分步规划与执行工作流 | `/plan-and-apply` |
| [website-cloner](./skills/website-cloner/) | 克隆在线站点为纯静态 HTML/CSS/JS | `/website-cloner` |
| [design-extract](./skills/design-extract/) | 提取网站/截图的设计风格为 DESIGN.md 设计系统文档 | `/design-extract` |

---

### html-prompt-generator

把模糊的需求概述转换为 3 个可直接投喂代码生成模型的中文提示词。支持稳健版、平衡版、探索版三种差异化输出。适用场景：落地页、看板、PPT 风格网页、教学 Demo 等。

[详细文档](./skills/html-prompt-generator/README.md)

### plan-and-apply

非平凡开发任务的执行框架。强制按"读规则 → 确认范围 → 最小拆分 → 分片执行 → 验证回归 → 干净收尾"的节奏工作。防止未理解就改代码、超范围重构、未验证就声称完成等常见问题。

适用场景：多文件改造、迁移、重构、结构化功能实现。

[详细文档](./skills/plan-and-apply/README.md)

### website-cloner

克隆任意在线站点为完全自包含的静态站点。纯 HTML/CSS/JS 输出，无框架依赖，所有资源（CSS、JS、字体、图片、favicon）自动下载为本地文件，完全离线可用，可迁移到任何框架。

适用场景：制作静态副本、离线存档、站点迁移前置、框架无关的页面复刻。

[详细文档](./skills/website-cloner/README.md)

### design-extract

提取任意网站或截图的设计风格，输出一份对标 Claude.com 设计文档标准的 `DESIGN.md` 设计系统文档。支持 URL 在线采集、本地截图（多模态分析）、URL+截图三种输入；由 Claude 自身视觉能力分析，零外部依赖；输出带设计 token（`{colors.*}` / `{typography.*}` / `{component.*}`）的完整设计系统参考。

适用场景：为 AI 编程/重设计提取设计参考、设计系统逆向、品牌风格复刻。

[详细文档](./skills/design-extract/README.md)

## 技能类型

本仓库所有技能均为**纯 SKILL.md 技能** — 不附带 CLI 工具，不依赖 npm 发布。通过 `npx skills add` 或手动复制安装。

## 贡献

新增技能时：
1. 在 `skills/` 下创建技能目录，包含 `SKILL.md`
2. 可选添加 `README.md` 作为详细说明
3. 在本文件技能列表中补充条目
