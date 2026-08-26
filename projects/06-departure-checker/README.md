# 出门检查官

一个纯前端、离线可用的移动端出门清单工具。用户选择八类出门场景之一，回答该场景的结构化条件，应用用确定性本地规则生成可解释清单。

## 功能

- 八场景直达与首次轻引导
- 每屏一个真实条件问题，答案点击直达下一题，也可逐题跳过
- 按重要程度、物品类别、空间巡视查看同一份清单
- 条目来源解释、条件重算差异和勾选状态保留
- 自定义项目与最后一分钟模式
- 最近三份本机清单、复制重算和显式覆盖
- 非关键内容降级与损坏存档恢复
- 路岚在首页、问答、清单、帮助、最后一分钟和完成页持续以大幅立绘陪伴

所有业务内容位于 `src/content/content.json`。应用不使用后端、运行时 CDN、定位、天气服务或在线 AI；结构化状态只保存在 `localStorage`，不保存图片、Base64、音视频或 Blob。

## 开发

```bash
pnpm dev
pnpm lint
pnpm test
pnpm build
```

小工具容器静态包校验：

```bash
pnpm validate:mini
```

可上传 ZIP 位于 `release-assets/departure-checker-v1.zip`。

## 设计与交付资料

- `UI-REDESIGN-V2.md`：最终 UI/UX 规格
- `NPC-LAYOUT-V3.md`：大立绘 NPC 陪伴式布局规格与验收结果
- `IMPLEMENTATION_PLAN-V3.md`：V3 实施与验证计划
- `INTERACTION-MOTION-SPEC.md`：交互、动效与无障碍规格
- `ART-REQUEST.md`：30 个 SVG 与 2 个 WebP 的资源清单
- `design/preview-v2.html`：18 状态静态设计预览
- `design/assets-v2.html`：16／24／32px 资源检查板
- `VISUAL-QA.md`：浏览器与三宽验收记录
- `PREP_REPORT.md`：内容、规则、存储和构建报告
