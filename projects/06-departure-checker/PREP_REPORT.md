# 出门检查官 Foundation PREP Report

日期：2026-08-24  
范围：`projects/06-departure-checker/**`  
内容版本：`1.0.0`，存储 schema：`1`

## 内容数据统计

| 实体 | 数量 |
|---|---:|
| 场景 | 8 |
| 清单项 | 83 |
| 携带项 | 77 |
| 出门前确认项 | 6 |
| 条件规则 | 36 |
| 场景问题 | 32 |
| 条件定义 | 24 |
| 分类 | 11（含自定义分类） |
| 空间位置 | 9 |
| 需要正式通知提示的项目 | 26 |

所有运行时业务内容均位于 `src/content/content.json`。没有远程 URL、图片、Base64、音视频或 Blob。

## 规则执行顺序

1. 从场景读取基础 itemId。
2. 用白名单操作符匹配条件规则，收集附加 itemId。
3. 标记 `safetyMandatory` 规则加入的项目及其保护优先级。
4. 按 `dedupeKey` 合并重复项、规则 ID 和不重复理由。
5. 按规则优先级从高到低处理移除、替代和冲突。
6. 计算最终 `must / should / optional`；安全规则加入的项目固定为 `must`。
7. 按携带/确认、优先级、内容顺序、首次加入顺序和稳定 ID 排序。
8. 生成条目解释及 `must / should / optional / confirmations` 四组 view model。

引擎只使用显式结构化条件，不使用 `eval`、动态表达式、随机评分或在线 AI。同一输入和内容版本得到完全相同的输出。

## 冲突解决规则

- 低优先级移除不能删除更高优先级安全规则加入的必带项。
- 替代目标参与去重选择；例如偏好雨衣时保留 `raincoat`，移除 `umbrella`。
- 冲突保留目标参与去重选择；例如户外运动保留 `water-bottle`，移除通用 `water`。
- 同一项目由多条规则加入时只保留一项，理由按首次出现顺序合并且不重复。
- 升级和降级同时命中时，规则优先级高者生效；同级冲突选择保护程度更高的优先级。
- 替代图在内容校验阶段做环检测，循环会阻止内容加载和生产构建。

## 黄金场景结果

| 组合 | 关键断言 |
|---|---|
| 通勤 + 雨 + 低电量 + 门禁 | 含雨伞、充电宝、充电线、门禁卡 |
| 短途 + 过夜 + 火车 + 晚归 | 含换洗、洗漱、车票、返程方案 |
| 室内运动 + 洗浴 | 含场馆凭证、毛巾、洗漱用品 |
| 户外运动 | 保留水壶，不重复保留通用饮水 |
| 户外约会 + 预订 + 晚归 | 含预约信息、合适鞋履、返程方案 |
| 婴儿 + 3 小时 + 乘机 | 含尿裤、安抚物、儿童食物、儿童证件 |
| 带狗 + 30 分钟 | 含牵引与拾便袋；不含宠物食物、饮水 |
| 容器带宠 + 90 分钟 + 雨 | 含宠物容器、宠物饮水、宠物毛巾；不含牵引 |
| 就医 + 无纸质要求 | 含身份证件与就医资料；不含复印件 |
| 办事 + 纸质要求 | 含表格、复印件和文件袋 |
| 电子票演出 + 晚归 + 大音量 | 含票、充电宝、听力保护；不默认加应援物 |

自动测试还覆盖全部 8 个场景的空条件回退、极端多条件、去重稳定和重复生成一致性。

## 存储 Schema

键名：`xhs-tool:departure-checker:state:v1`

```ts
type StoragePayload = {
  schemaVersion: 1;
  contentVersion: string;
  activeChecklistId?: string;
  savedChecklists: SavedChecklist[]; // 最多 3 份，按 updatedAt 倒序
  updatedAt: string;
};

type SavedChecklist = {
  id: string;
  name: string; // 最多 40 字
  scenarioId: string;
  conditions: Record<string, string | boolean | number | Array<string | boolean | number>>;
  items: Array<{
    itemId?: string;
    checked: boolean;
    customLabel?: string; // 最多 30 字
    customPriority?: "must" | "should" | "optional";
    customCategoryId?: string;
    customLocationId?: string;
  }>;
  createdAt: string;
  updatedAt: string;
  contentVersion: string;
};
```

损坏 JSON 和未来 schema 不会被静默覆盖；读取结果返回可恢复原文，用户明确清空后才能重建。内容更新后失效的非关键 itemId 会被过滤并显示恢复提示。保存第四份时不会静默覆盖：先返回候选旧记录，用户可改选目标、取消或明确确认覆盖。

## UI 接口

页面状态：`landing → scenarioSelect → conditionWizard → generating → checklist → summary`，另有 `itemDetail`、`savedLists` 和 `error`。

清单页消费 `GeneratedChecklist`，支持：

- 按重要程度、物品类别、空间巡视分组；视图切换不复制清单状态。
- 勾选/取消、全部重置、查看原因、返回修改条件并重新生成。
- 仍存在的条目在重新生成后保留勾选状态。
- 新增/删除最多 30 字的本机自定义文本项。
- 保存、恢复和删除最近清单。
- 空状态、生成状态、完成摘要和损坏恢复。

响应式 CSS 使用流式容器与 `minmax(0, 1fr)`：430px 视口内容宽 398px；390px 视口内容宽 366px；375px 视口内容宽 351px。390/375 断点缩小网格并将条目操作换行，主要按钮和交互控件最小高度 44px，底部操作避让 `safe-area-inset-bottom`。

## V2 图标与引导资源

- 场景：`icon-scenario-commute`、`icon-scenario-short-trip`、`icon-scenario-exercise`、`icon-scenario-date`、`icon-scenario-with-child`、`icon-scenario-with-pet`、`icon-scenario-appointment`、`icon-scenario-event`。
- 分类：`icon-category-*`；位置：`icon-location-*`。
- 状态：`completion-stamp.svg`、`partial-available.svg`。
- 引导：`guide-master-v2.webp`、`guide-avatar-v2.webp`。

最终实现不为 83 个物品逐项绘图；清单行复用类别图标和结构化文字。30 个 SVG 与 2 个 WebP 均为本地静态资源，无运行时 CDN。

## V3 路岚陪伴式布局

- 新增统一的 `GuidePortrait` 展示组件，使用 `home / wizard / summary / urgent / completion / help` 六个受控裁切变体。
- 首页、条件问答、清单摘要、帮助、最后一分钟和完成结果均展示半身级主立绘；最近清单和部分恢复状态使用头像。
- 复用既有 900×1200 主图与 160×160 头像，没有新增美术资源、业务内容或依赖。
- 所有业务文案与控件仍是 DOM；清单人物区使用可访问按钮，重复立绘不重复播报替代文本。
- 页面状态、规则引擎、`content.json` 与存储 schema 均未修改。
- 首页最终使用人物优先构图：主标题位于纸面，立绘横向占比约 66%–68%，避免标题换行挤占角色空间。
- 条件问答的布尔、单选和数字预设点击后直接前进；末题通过纯函数合并最新条件后生成，手动数字保留显式确认。
- 首次引导和大图帮助不再重复头像；问答答案（含数字预设）固定两列，底栏最多两个导航按钮。
- 直接进入下一题后焦点移到新题标题；取消条件差异会恢复原清单条件，避免摘要与清单不一致。

## 测试与构建结果

- `pnpm lint`：通过，0 条错误。
- `pnpm test`：通过，12 个测试文件、81 项测试。
- `pnpm build`：通过；小工具经典脚本产物 JS gzip 93.55 kB，样式随 IIFE 注入。
- `pnpm validate:mini`：通过；离线 ZIP 根目录包含 `index.html`，无外部资源或禁用端能力调用。
- 375 / 390 / 430 CSS px：真实浏览器检查均满足 `documentElement.scrollWidth === documentElement.clientWidth`，0 断图。
- 完整黄金流程已覆盖条件问答、无精确匹配、生成、三视图、空间路线、条目解释、条件差异、完整关键项、保存/恢复/原位更新和第四份显式覆盖；控制台 0 error。

最终结果以完成本报告后重新运行的验证命令为准。
