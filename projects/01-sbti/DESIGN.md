# Design System — SHBTI｜山海兽格测试

状态：`VISUAL DIRECTION APPROVED`  
批准日期：2026-08-23  
适用范围：`projects/01-sbti/**`

## Product Context

- **产品**：以 24 道山海情境题完成四维偏好计分，并映射至 16 种异兽人格结果的纯前端移动端小工具。
- **用户**：喜欢人格测试、国风文化、轻量剧情和收藏分享的中文移动端用户。
- **定位**：娱乐性文化创作，不是心理诊断；原典事实与产品演绎必须分栏。
- **体验承诺**：答题像进入山海世界，结果像得到一页值得收藏的异兽志。

## Aesthetic Direction

- **视觉命题**：古籍夜读 × 山海雾境 × 矿物显色。
- **装饰程度**：有节制的表现力。首页、章节与显形仪式可以有氛围；题目阅读区保持克制。
- **情绪弧线**：深色夜读入山 → 雾中判断 → 朱砂落印 → 暖纸兽志显形。
- **明确避免**：红金宫廷、仙侠手游金光、过度 Q 版、赛博霓虹、紫色渐变、烧焦纸边、满屏祥云。

## Design Principles

1. **题目优先**：古风装饰不得降低阅读和选择速度。
2. **古籍与创作分界可见**：结果页明确区分原典、后世解释与 SHBTI 创作。
3. **异兽先墨后色**：大面积墨色建立统一性，矿物色只强调识别特征。
4. **仪式集中在关键时刻**：动效只用于选择、换卷、落印和显形。
5. **分享卡是独立构图**：不直接截取结果页，不塞满说明文字。

## Typography

- **品牌与章节标题**：`Noto Serif SC`, `Source Han Serif SC`, `Songti SC`, serif。
- **异兽称号点缀**：`KaiTi`, `STKaiti`, serif；仅用于短标题，不用于正文。
- **题目、选项与操作**：`Noto Sans SC`, `Source Han Sans SC`, `PingFang SC`, `Microsoft YaHei`, sans-serif。
- **类型代码与维度代码**：`IBM Plex Mono`, `JetBrains Mono`, monospace。
- **加载策略**：正式发布优先自托管 WOFF2；断网时使用系统 fallback，不能阻塞首屏。

```css
--text-xs: 0.75rem;      /* 12 */
--text-sm: 0.875rem;     /* 14 */
--text-body: 1rem;       /* 16 */
--text-body-lg: 1.125rem;/* 18 */
--text-title-sm: 1.375rem;/* 22 */
--text-title: 1.75rem;   /* 28 */
--text-display: 2.5rem;  /* 40 */
--text-result: 3.25rem;  /* 52 */
```

正文行高不得低于 `1.65`；题干建议 `20–22px / 1.55`。

## Color

色彩原则：暖纸与青墨为主体，朱砂只标记关键动作和落印，石青/石绿/赭石区分章节与异兽。

```css
:root {
  --paper: #f1e7cf;
  --paper-light: #f8f1df;
  --paper-deep: #ded0b2;
  --night: #121c1b;
  --night-raised: #1a2926;
  --ink: #182321;
  --ink-soft: #46534e;
  --ink-muted: #727a70;
  --ink-on-night: #eee2c7;
  --cinnabar: #a63d2f;
  --cinnabar-dark: #762a22;
  --malachite: #3f7464;
  --malachite-light: #79a493;
  --azurite: #365d73;
  --ochre: #b6864f;
  --gold-muted: #b79a62;
  --success: #557b5b;
  --warning: #a66e32;
  --error: #9b3b32;
  --info: #466b7e;
}
```

深色面使用纸色文字；浅色面使用青墨文字。任何正文组合至少满足 WCAG AA。

## Spacing and Shape

- **基准视口**：390 × 844 CSS px；同时检查 375、390、430px。
- **内容宽度**：移动端 `100%`，桌面预览最大 `430px`。
- **页面边距**：20px；小屏可降至 16px。
- **基础单位**：4px。
- **密度**：题目页舒适，结果页宽松。

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
--radius-control: 6px;
--radius-card: 10px;
--radius-sheet: 2px;
--radius-pill: 999px;
```

纸页、案卷和结果卡保持近直角；普通控件小圆角；状态标签才使用胶囊形。

## Layout

- **方式**：混合布局。答题流程使用稳定单栏网格；首页与结果页采用编辑化竖版构图。
- **首屏**：只保留品牌、异兽剪影、核心承诺、时长/题量和开始按钮。
- **答题页**：顶部章节与进度，中部题干，下部两个等权选项；不展示计分方向。
- **结果页**：结论先行；异兽主图可突破网格；维度、优势、盲区和文化边界随后展开。
- **分享卡**：4:5 独立构图，包含异兽、代码、称号、一句话和四枚维度印。

## Components

- `AppShell`：控制夜读/暖纸表面与安全区。
- `ChapterHeader`：卷名、题号、进度线。
- `StoryQuestion`：情境题干，不包含计分逻辑。
- `ChoicePanel`：甲/乙等权选择；选中后墨迹反馈。
- `DimensionSeal`：计算页与结果页复用的维度印。
- `BeastReveal`：剪影、显色、落印三阶段，可降级。
- `ProfileHero`：类型、称号、异兽和一句话。
- `InterpretationSection`：原典、后世/解释、产品创作分栏。
- `ShareCard`：固定 4:5 ViewModel 消费者。

## Motion

```css
--duration-micro: 100ms;
--duration-short: 180ms;
--duration-medium: 320ms;
--duration-reveal: 700ms;
--ease-enter: cubic-bezier(.16, 1, .3, 1);
--ease-exit: cubic-bezier(.7, 0, .84, 0);
--ease-move: cubic-bezier(.65, 0, .35, 1);
```

- 选项反馈：180ms 墨迹收拢。
- 换题：320ms 上移淡出/下方进入。
- 换卷：500–700ms 山雾横过。
- 结果：轮廓 → 矿物色 → 兽格印。
- `prefers-reduced-motion`：降级为不超过 180ms 的淡入，取消位移、粒子和依次落印。

## Asset Direction

- **异兽主图**：4:5、无文字、无边框、无印章、主体完整、上方 35% 放头部、四周留安全区。
- **风格**：宋元山水册页中的异兽工笔与当代编辑插画结合；清晰墨线、克制矿物设色、淡山雾、轻纸纤维。
- **禁止**：战斗姿势、写实恐怖、Q 版萌化、满彩金光、复杂宫殿背景、现代饰品、水印。
- **生产顺序**：陆吾基准图 → 凤凰/精卫/烛阴验证 → 其余 12 兽。
- **位图**：首选 WebP；透明主体可用 PNG/WebP；项目中必须提供轻量 fallback。

## Copy Rules

- 用户称谓以“你”为主，避免审判口吻。
- 使用“倾向”“像是”“在这些情境中”而不是“你就是”。
- MBTI 只写“MBTI-like 偏好回声”或“结构上接近”。
- 固定说明：娱乐性文化创作，不用于心理诊断、能力评估或重要人生决策。

## Accessibility

- 所有功能可通过键盘完成。
- 点击区域至少 44 × 44px。
- 不用颜色作为唯一状态提示。
- 图片具有与结果有关的替代文本；纯装饰图片使用空 alt。
- 显形动画不可阻塞结果阅读。
- 支持减少动画和高对比度环境。

## Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-08-23 | 采用“古籍夜读 × 山海雾境 × 矿物显色” | 与普通 MBTI 换皮和仙侠卡牌拉开差异，同时保持题目可读性 |
| 2026-08-23 | 夜读答题、暖纸结果 | 建立从入山到获得兽志的情绪弧线 |
| 2026-08-23 | 异兽先墨后色 | 用统一墨线控制 16 兽的一致性，以局部矿物色建立个体辨识度 |
| 2026-08-23 | 先生产陆吾基准图 | 在批量生成前锁定风格、构图和资源预算 |

## 引导角色

守卷人**闻山**是唯一常驻引导者。角色只在首次三句引导、结果揭晓、可召回帮助和异常恢复出现；深松绿守卷人形象不能遮挡题目或异兽，完整规范见 `NPC-SPEC.md`。
