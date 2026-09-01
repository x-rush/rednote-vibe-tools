# 星风来信（Starwind Letter）

一个面向手机竖屏的纯前端互动动画：句子快速轮播，用户点击一次让它减速并随机停下；随后风自动吹起窗帘、吹开窗户，把窗外的星星带进房间，最终组成一张“今晚星语”。

本目录当前仅包含策划、交互、动效、内容和实施文档，不包含应用代码。

## 核心原则

- 用户不输入文字。
- 用户不拖动或滑动窗帘。
- 首次体验只需要点击一次。
- 点击之后的主动画全自动完成。
- 星星必须明确从窗外进入室内，不能反向飞出。
- 动画本身就是界面，不堆叠卡片、表单、导航和复杂按钮。
- 全站纯前端静态运行，无后端、运行时 CDN 或必需外部 API。

## 文档索引

- [PROJECT_BRIEF.md](./PROJECT_BRIEF.md)：产品目标、体验闭环与范围。
- [UX_SPEC.md](./UX_SPEC.md)：页面状态、操作规则、异常与可访问性。
- [MOTION_SPEC.md](./MOTION_SPEC.md)：逐秒分镜、空间关系与动效验收标准。
- [CONTENT_SPEC.md](./CONTENT_SPEC.md)：内置星语的写作规范、分类与首批句库。
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)：供开发 Agent 执行的阶段计划和验收清单。
- [CODEX_PROMPT.md](./CODEX_PROMPT.md)：可直接复制到 WSL Agent 的完整提示词。
- [AGENTS.md](./AGENTS.md)：本项目开发边界。

## 一句话体验

> 点击，让星空为你留下一句话；接着等风吹开窗帘和窗户，把窗外的星星带到你身边。
