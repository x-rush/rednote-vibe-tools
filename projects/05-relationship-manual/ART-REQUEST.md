# 深夜信笺编辑部 · 美术资源清单

状态：`GENERATED · INTEGRATED · QA PASSED`
更新：2026-08-26

## 功能性资源

| 顺序 | 正式文件 | 规格 | 功能价值 | 结果 |
|---:|---|---|---|---|
| 1 | `public/assets/guide/xiaoman-daily-v2.webp` | 1080×1440，透明 WebP，243,686 bytes | 首页、联系／关心／修复章节和装订结果的日常陪伴态 | 已生成并接入 |
| 2 | `public/assets/guide/xiaoman-listening-v2.webp` | 1080×1440，透明 WebP，304,116 bytes | 倾听／空间章节的专注倾听态 | 已生成并接入 |
| 3 | `public/assets/guide/xiaoman-reminder-v2.webp` | 1080×1440，透明 WebP，236,230 bytes | 分歧／边界、冲突合并和存储失败的温和提醒态 | 已生成并接入 |
| 4–10 | `src/assets/art/topic-*.svg` | 7 个 24×24 SVG | 七章进度、回顾、编辑与结果章节识别 | 已接入 |
| 11 | `src/assets/art/local-only.svg` | 24×24 SVG | 本机保存状态 | 已接入 |
| 12 | `src/assets/art/sensitive.svg` | 24×24 SVG | 敏感章节提示，始终与文字同现 | 已接入 |
| 13 | `src/assets/art/edit-conflict.svg` | 24×24 SVG | 手工改写需复核状态 | 已接入 |
| 14 | `release-assets/tool-icon-v1.png` | 1024×1024 RGBA PNG，1,848,402 bytes | 小工具后台上传用品牌图标；不进入运行时 ZIP，避免增加首屏体积 | 已生成并保留为交付资源 |

三张立绘合计 784,032 bytes（约 766 KiB），低于 1.2 MB 预算；均为 `yuva420p`，实际透明通道覆盖 0–255。角色身份固定为成年中国女性编辑搭档：棕色低马尾、暖灰针织开衫、鼠尾草绿上衣、白色长裤和蓝铅笔。三态只改变姿势与表情。

## 生成来源

| 状态 | ImageGen 原始结果 |
|---|---|
| daily | `/home/xrush/.codex/generated_images/01a03bac-d3d8-7f01-9e5d-4bd762d0b705/exec-ba9ccf54-d564-4c2b-97e4-81ebc06861f7.png` |
| listening | `/home/xrush/.codex/generated_images/01a03bac-d3d8-7f01-9e5d-4bd762d0b705/exec-bc7e9ff7-01f8-4622-97d8-c27ee82f4d37.png` |
| reminder | `/home/xrush/.codex/generated_images/01a03bac-d3d8-7f01-9e5d-4bd762d0b705/exec-4bc62d52-59ea-463c-8aaa-0cbae813669e.png` |

原图经本地 `ffmpeg` 转为 1080×1440 WebP；无运行时 CDN、外部 API 或远程字体依赖。

## 由 CSS／DOM 生成

- 暖白信纸、批注纸、折痕、页角、装订线与蓝铅笔修订线。
- 七章文件夹转场、对话框、冲突便签、完整版信件与 4:5 简洁分享卡。
- 图片解码失败时的“满”字印章；姓名、身份、台词和操作仍为 DOM 文本。

## 明确不生成

- 情侣、家庭或冲突现场插画；不把用户关系内容画进立绘。
- 好感度、爱心粒子、戒指、礼物、恋爱路线或诊断量表。
- 语音、口型、逐帧动画、第二 NPC、背景照片与运行时生成素材。

## 单资源与整体验收

- 三图身份、服装、发型、光线与 Galgame 风格一致；无文字、水印、爱心、医疗／诊断符号。
- daily 仅有蓝铅笔和两张空白卡；listening 不含卡片；reminder 仅含一张空白便签。
- 375／390／430 CSS px 无横向溢出，正常加载 0 断图，按钮最小高度 44px。
- 拦截立绘请求后，“满”字印章、姓名、身份和台词仍完整，核心流程可继续。
- `prefers-reduced-motion: reduce` 下立绘、对话与文件夹无位移或过渡。
