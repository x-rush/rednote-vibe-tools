# 出门检查官 · UI/UX 重设计会话提示词

你在 `~/project/www/rednote-vibe-tools` 工作，本轮只重设计 `projects/06-departure-checker` 的 UI/UX、清单生成反馈和微动效，不写业务代码。用户仅恢复设计工作。不得改其他项目、根配置、锁文件或 `docs/`。

先读根/项目 `AGENTS.md`、`TODO.md`、`PROJECT_BRIEF.md`、`DESIGN.md`、`IMPLEMENTATION_PLAN.md`、`UX-SPEC.md`、`UI-HANDOFF.md`、`NPC-SPEC.md`、`PROMPTS.md`、`VISUAL-QA.md`。保持本地规则生成、无天气/地图 API、非安全保证和一分钟完成目标。

目标：让工具像一名可靠但不焦虑的“出发前检查官”。高级玩法包括：场景卡快速组合目的/天气/同行者/时长；系统清楚展示哪些是基础必带、哪些由条件触发；支持按类别和家中位置两种整理视角；勾选后显示剩余关键路径；最后一分钟模式只保留必须项；历史清单可复制后重新计算条件；路岚解释某项为何出现，不以红色警报施压。

设计首页、最近场景、场景组合、条件追问、生成过渡、分类清单、空间清单、项目解释、条件变化、最后一分钟、全部完成、历史复用、无匹配降级、部分内容不可用、坏存档和 reduced-motion。逐屏验证 375 / 390 / 430 CSS px。动效围绕物品归位、路径收束、完成章和条件标签迁移；不使用倒计时恐吓、3D 商品图或 emoji 混搭。

只创建/修改 `UI-REDESIGN-V2.md`、`INTERACTION-MOTION-SPEC.md`、`design/preview-v2.html`、`ART-REQUEST.md`；至少 14 个手机状态。优先复用现有 28 个 SVG 与路岚资源。

`ART-REQUEST.md` 只列真实内容 JSON 合并后确实缺失的场景/类别/空间 SVG、完成章和路岚状态，不为每个物品申请图片。完成后停止，不写代码。
