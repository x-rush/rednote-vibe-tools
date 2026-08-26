# 新 Codex 会话提示词

你正在 `~/project/www/rednote-vibe-tools` 的 `main` 分支工作，只负责 `projects/02-wuhualu`。

完整阅读根和项目 `AGENTS.md`，再读 `TODO.md`、`REDESIGN-V2.md`、`CONTENT-V2-CONTRACT.md`、`NPC-GUIDE-SYSTEM-V2.md`、`DESIGN.md`、`UX-SPEC.md`、`UI-HANDOFF.md`、`PROMPTS.md`、`VISUAL-QA.md`。先检查已有未提交修改，不得覆盖其他会话成果。不得修改其他项目、根配置、锁文件或 `docs/`。

目标：接入 Windows 美术会话交付的已审核资源，并按 V2 契约实现《器华录》。不要自行生成或猜测文物形象；缺资源时列出准确交付规格，使用现有可信降级，不伪造实物。业务内容只放 `src/content/content.json`；纯前端、无外部 API；不得保存用户图片或 Blob。

按 `TODO.md` 一次完成一个可验证切片。先报告当前资源数、内容数、状态机差距和本轮范围，再开发。完成后执行 `pnpm lint && pnpm test && pnpm build`，验证 375 / 390 / 430 CSS px，只提交本目录。最终给出提交号、测试证据、剩余 TODO，以及下一批所需美术资源的文件名、比例、用途和裁切安全区。
