# 器华录 UI Handoff

先实现：封面 → 模式说明 → 观察/猜测 → 揭晓 → 收入图鉴 → 图鉴详情。

必要组件：`MuseumShell`、`ArtifactStage`、`ClueRail`、`ArchiveOption`、`RevealLabel`、`CollectionDrawer`、`ProvenanceBadge`。

UI 只消费类型化 ViewModel；所有图片通过 manifest ID 解析。任何 AI 重构图必须同时渲染 `assetNature` 标签。图片失败时展示轮廓与文字线索，游戏仍可完成。

## v6 manifest 接入边界

- 可直接完成全部静态角色接入的 9 件：鹰形陶鼎、人面鱼纹彩陶盆、贾湖骨笛、红山玉龙、后母戊鼎、四羊方尊、莲鹤方壶、云纹铜禁、曾侯乙尊盘。
- 仅有条件揭晓图、不得假装完整资源包的 2 件：越王勾践剑、长信宫灯；缺少经核验剪影／缩略／完整线索裁切时必须走文字与通用轮廓降级。
- 其余 9 件仍保持 `reference-required`，首发真实题局不得解析到不存在的主图；内容层若保留条目，只能作为后续图鉴占位，不进入随机抽题池。
- manifest 的 `remaining` 是运行时门禁而非装饰文本：含 `real-app-dynamic-qa` 的条目可进入开发联调，但在动态答题、失败恢复、性能与来源标签全部通过前不能标记为上线资源。

375/390/430px 验收；观察区不能被固定按钮遮挡；揭晓后来源信息在首屏下方一屏内可见。

新增 `GuideIntro/GuideAvatarButton/GuideHelpSheet/GuideRecovery`；阿照层不得覆盖文物观察区，文本不烧入人物图，跳过与重载均为独立可聚焦操作。详见 `NPC-SPEC.md`。
## NPC 四态实现冻结

| 状态 | 预览 ID | 触发 | 主动作 | 关闭／恢复后保留 |
|---|---|---|---|---|
| 首次引导 | `case-guide-xuzhao` | 首次进入闭馆挑战 | 下一句／跳过 | 直接进入第一件藏品 |
| 节点反馈 | `case-guide-xuzhao-feedback` | 本题第一次猜错 | 再观察／使用提示星 | 已排除选项、星数与观察层 |
| 召回帮助 | `case-guide-xuzhao-recall` | 用户点许照头像 | 回到藏品台 | 当前藏品、作答次数和提示使用 |
| 异常恢复 | `case-guide-xuzhao-recovery` | 题目结构或图像不可用 | 无惩罚跳过／重建 | 已完成题、星数、已解锁图鉴 |

正式资源使用 `public/assets/wuhualu/guide`；图像失败不得把损坏占位写进图鉴，事实来源与艺术化示意保持独立 DOM 标签。

## 真实工程接入审计（2026-08-25）

WSL 工程 `projects/02-wuhualu/src` 已有完整状态机、题局算法、收藏持久化和 `Artifact.assetRefs` 数据契约，但截至本次审计，四个关键页面仍未消费图片资源：

| 真实代码位置 | 当前实现 | 首发必须替换为 |
|---|---|---|
| `App.tsx` 题目页 `artifact-stage` | `placeholder-form` 几何占位 | `ArtifactMedia(role="clue")`，随已揭示线索级别选取 clue crop；不可用时显示剪影和文字线索 |
| `App.tsx` `feedback` | 只有名称、星数和事实卡 | `ArtifactMedia(role="reveal")`；主图下方独立显示资源性质和事实核验标签 |
| `App.tsx` `collection-card` | 通用 `collection-figure` | 已解锁用 `role="thumbnail"`；未解锁仅用本地剪影，不泄露名称或主图 |
| `App.tsx` `artifactDetail` | `placeholder-form` 几何占位 | `ArtifactMedia(role="reveal")`，保留尺寸、出土、馆藏和来源说明 |
| `game/view-models.ts` | 已原样输出 `artifact.assetRefs` | 保留；增加资源可用性和 `assetNature` 的类型化展示字段，不在组件里猜状态 |

### 建议文件边界

- `src/ui/artifact-assets.ts`：唯一的 manifest 解析和资源 ID → URL 映射入口；拒绝路径穿越、外链和未知 ID。
- `src/ui/ArtifactMedia.tsx`：统一处理 `clue | reveal | thumbnail | silhouette`、`onError` 降级、宽高、懒加载和无障碍替代文本。
- `src/ui/ProvenanceBadge.tsx`：单独渲染 `reference-photo`、`artistic-reconstruction`、`creative-reconstruction` 等资源性质；不得把标签烧进图片。
- `src/game/eligible-artifacts.ts`：根据 manifest 生成可抽题集合；题局算法只接收已过滤的数组，不在抽中后临时补救。
- `src/ui/artifact-assets.test.ts`：覆盖所有首发资源 ID、文件存在性、禁止外链、角色降级链和九件可玩文物。

### 资源角色与降级顺序

| 页面角色 | 首选 | 第一次失败 | 第二次失败 | 最终状态 |
|---|---|---|---|---|
| 观察题面 | 对应线索裁切图 | 已核验剪影 | CSS 本地通用轮廓 | 文字线索仍可答题 |
| 答案揭晓 | 完整揭晓图 | 已核验剪影 | CSS 本地通用轮廓 | 名称、年代、材质和事实卡仍完整 |
| 图鉴卡片 | 缩略图 | 已核验剪影 | CSS 本地通用轮廓 | 已解锁状态和星级仍可辨认 |
| 图鉴详情 | 完整揭晓图 | 已核验剪影 | CSS 本地通用轮廓 | 来源信息和事实正文仍可读 |

降级只影响显示，不得改写答题结果、扣星、写入损坏 URL 或污染收藏数据。每个 `<img>` 必须有固有 `width`/`height` 或 CSS `aspect-ratio`，避免加载时布局跳动；非首屏图使用 `loading="lazy"`，当前题和当前揭晓图使用 eager。

### 首发抽题门禁

1. `playable-static`：九件五角色齐全的文物，可进入图片题局。
2. `text-fallback-only`：越王勾践剑、长信宫灯只允许文字题／完整图条件揭晓，不得把缺失裁切图当作已完成。
3. `reference-required`：其余九件不得进入首发随机池；可保留在锁定图鉴中，并明确标记“资料整理中”。
4. 每轮仍为 5 题。过滤后不足 5 件时不得静默扩入不合格条目，应显示可恢复错误并保留已有进度。
5. 图鉴分母必须表达内容口径：首发建议显示“已收录 X / 20”，同时以小字说明“本期可探索 9 件”，避免把资源门禁伪装成内容缺失。

### 动态验收场景

- 375、390、430 CSS px 各跑一轮 5 题，覆盖首次进入、追加线索、答对、答错后再观察、揭晓、总结、图鉴、详情和返回。
- 强制让 clue、reveal、thumbnail 各失败一次，确认降级链无破图、无死局、无错误收藏数据。
- 检查九件可玩文物至少各被固定 seed 命中一次；条件可用和 `reference-required` 文物不得进入图片题局。
- 关闭再打开后恢复正在进行的题局；manifest 版本变化时能安全迁移或重建，不读取旧的损坏资源 URL。
- 检查图片裁切焦点、文字对比度、底部动作区遮挡、CLS、首屏资源体积及来源标签在各宽度下的可见性。
