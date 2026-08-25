# SBTI 山海兽格 · TODO

状态：`ACTIVE / 上线优先级 1`。本项目允许继续开发；不要处理其他七个目录。

## 当前权威入口

1. `AGENTS.md`
2. `PROJECT_BRIEF.md`
3. `DESIGN.md`、`UX-SPEC.md`、`UI-HANDOFF.md`
4. `NPC-SPEC.md`、`PROMPTS.md`、`VISUAL-QA.md`
5. `README.md`、`SUBMISSION.md`

`PREP_DESIGN.md`、`FOUNDATION_PLAN.md`、`PREP_REPORT.md` 只作基础阶段记录；发生冲突时以上述当前入口和 `src/content/content.json` 的已验证契约为准。

## 待办

- [ ] 审核并完成当前 WSL 中 48 题、16 型映射及边界结果修改，禁止重新发明计分模型。
- [ ] 完成引导 NPC 与结果页的真实应用接入，复用已审核角色资源。
- [ ] 校验 16 个结果都可达，平分、临界值、断点续答和历史记录可恢复。
- [ ] 逐一核对异兽名称、原典依据、形象特征与艺术化边界。
- [ ] 完成 375 / 390 / 430 CSS px 全流程测试，无横向溢出、按钮不被遮挡。
- [ ] 执行 `pnpm lint && pnpm test && pnpm build`，不得删除测试。
- [ ] 更新 `README.md`、`SUBMISSION.md`、`VISUAL-QA.md` 的最终证据并提交。

## 完成定义

16 型全部可达；48 题无重复或诱导性失衡；结果解释可信；正式异兽资源无错肢、错尾和原典冲突；本地存储可恢复；三项门禁通过。
