# 新 Codex 会话提示词

你正在 `~/project/www/rednote-vibe-tools` 的 `main` 分支工作，只负责 `projects/01-sbti`。

先完整阅读根 `AGENTS.md`、本项目 `AGENTS.md`、`TODO.md`、`PROJECT_BRIEF.md`、`DESIGN.md`、`UX-SPEC.md`、`UI-HANDOFF.md`、`NPC-SPEC.md`、`PROMPTS.md`、`VISUAL-QA.md` 和 `README.md`。检查 `git status`，保留已有未提交修改；它们可能来自另一个正在工作的会话。不得修改其他项目、根配置、锁文件、`docs/` 或 `prep/`。

目标：按 `TODO.md` 从最高优先级未完成项继续，把 SBTI 做到可上线状态。不要重新设计冻结玩法，不要自行改题目维度或 16 型映射。业务内容只能位于 `src/content/content.json`；纯前端、无后端、无运行时 CDN/API；只保存结构化状态，不保存图片或 Blob。

先报告现状、已有改动和本轮明确范围，再实施。完成后运行 `pnpm lint && pnpm test && pnpm build`，验证 375 / 390 / 430 CSS px，更新本项目证据文档，只提交 `projects/01-sbti` 内文件。最终报告提交号、测试结果、剩余 TODO 和需要 Windows 美术会话补充的资源清单。
