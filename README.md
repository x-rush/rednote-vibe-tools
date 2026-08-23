# 小红书八个纯前端小工具

这是一个 pnpm workspace，包含八个互相独立的 React + TypeScript + Vite 工程。产品资料在 docs，机器可读准备清单在 prep，工程在 projects。

## 总体验证

pnpm install
pnpm check

## 并行开发

每个 Codex CLI 只进入一个 projects/<project> 目录，并先阅读该目录的 AGENTS.md 与 PROJECT_BRIEF.md。根锁文件和其他项目目录不得并行修改。

详细分配见 projects/README.md，文档分类见 docs/README.md。
