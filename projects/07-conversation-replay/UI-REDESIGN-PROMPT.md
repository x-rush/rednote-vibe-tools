# 当时这样说就好了 · UI/UX 重设计会话提示词

你在 `~/project/www/rednote-vibe-tools` 工作，本轮只重设计 `projects/07-conversation-replay` 的 UI/UX、对话拆解交互和微动效，不写业务代码。用户仅恢复设计工作。不得改其他项目、根配置、锁文件或 `docs/`。

先读根/项目 `AGENTS.md`、`TODO.md`、`PROJECT_BRIEF.md`、`DESIGN.md`、`IMPLEMENTATION_PLAN.md`、`UX-SPEC.md`、`UI-HANDOFF.md`、`NPC-SPEC.md`、`PROMPTS.md`、`VISUAL-QA.md` 和 32 情境资料。保持纯选项、本地隐私、非诊断和不上传聊天记录。

目标：把复盘设计成“事实—推测—感受—需要—请求”的句子编辑台，不模拟聊天 App。高级玩法包括：玩家从冻结情境中选择当时目标；把一句话拆成可拖动但键盘可操作的语义纸条；识别事实和推测混合；选择不同语气预览表达变化；替代表达不是标准答案而是多种边界强度；完成后可做一次无压力演练并收藏。迟言负责指出句子结构，不评判谁对谁错。

设计隐私首页、情境选择、目标选择、原句拆解、事实/推测辨析、感受与需要、请求重写、语气对照、安全优先分支、演练、结果卡、收藏、坏存档、长文本和 reduced-motion。逐屏验证 375 / 390 / 430 CSS px。动效使用纸条拆分、批注、句子重排和修订痕迹；禁止聊天气泡、对方头像、红绿对错、争吵插画和情绪分数。

只创建/修改 `UI-REDESIGN-V2.md`、`INTERACTION-MOTION-SPEC.md`、`design/preview-v2.html`、`ART-REQUEST.md`；至少 14 个手机状态。优先 CSS/SVG/排版，复用迟言和现有图标。

`ART-REQUEST.md` 只申请确有交互用途的步骤 SVG、纸张/批注系统、迟言状态和分享模板；明确“不生成聊天截图或冲突人物图”。完成后停止，不写代码。
