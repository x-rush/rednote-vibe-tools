# 证物视觉来源登记簿

日期：2026-08-26

本登记簿与 `src/content/content.json` 的 `sources` 以稳定 `sourceId` 连接；直接 URL、来源等级与边界说明以对应来源记录为准。本轮所有字形视觉均采用 `structure-diagram`，不复刻、不描摹、不生成甲骨文、金文或小篆，因此不冒充原片、拓影或权威数据库字形。字书使用产品排版并明确区分材料定位与产品释文。

审核口径：内容 v2 已有 A/B 来源边界复核；精确古文字双人审校不适用。若以后换入精确字形，必须新增著录号、授权、描摹者和第二审核者后才能改变资源性质。

| 证物 ID | 视觉模板 | 资源性质 | 来源 ID | 审核状态 |
|---|---|---|---|---|
| `evidence-home-early-form` | 字形时间轴 | structure-diagram | `source-home-shuowen`, `source-home-moe-variants` | 结构关系可用；无精确古字形 |
| `evidence-home-shuowen` | 字书展开卷 | product-typesetting | `source-shuowen-general`, `source-home-moe-variants` | 材料定位与产品释文已分层 |
| `evidence-home-phonetic` | 语义关系图 | product-diagram | `source-home-moe-variants`, `source-home-shuowen` | 声符功能按可能关系呈现 |
| `evidence-home-social-leap` | 辨伪对照卷 | product-diagram | `source-home-moe-variants` | 社会史越界点已标出 |
| `evidence-rest-components` | 字形时间轴 | structure-diagram | `source-shuowen-general`, `source-rest-moe-variants` | 人木关系可用；无精确古字形 |
| `evidence-rest-gloss` | 字书展开卷 | product-typesetting | `source-shuowen-general`, `source-rest-moe-variants` | 传统解释与方法边界已分层 |
| `evidence-rest-method-limit` | 语义关系图 | product-diagram | `source-rest-moe-variants` | 个例与通则断线已标出 |
| `evidence-rest-modern-shape` | 辨伪对照卷 | product-diagram | `source-rest-moe-variants` | 楷形倒推边界已标出 |
| `evidence-take-form` | 字形时间轴 | structure-diagram | `source-take-ctext`, `source-take-moe-variants` | 手耳关系可用；无精确古字形 |
| `evidence-take-rite` | 字书展开卷 | product-typesetting | `source-take-ctext`, `source-take-moe-variants` | 制度材料与后世义项已分层 |
| `evidence-take-semantic-change` | 语义关系图 | product-diagram | `source-take-moe-variants` | 义变阶段按关系图呈现 |
| `evidence-take-moral-fallacy` | 辨伪对照卷 | product-diagram | `source-take-moe-variants` | 道德倒推断线已标出 |
| `evidence-pick-form` | 字形时间轴 | structure-diagram | `source-pick-zhu`, `source-pick-moe-variants` | 爪木关系可用；无精确古字形 |
| `evidence-pick-bian-distinction` | 字书展开卷 | product-typesetting | `source-pick-bian`, `source-pick-moe-variants` | 釆、采字头已分层 |
| `evidence-pick-extensions` | 语义关系图 | product-diagram | `source-pick-moe-variants`, `source-pick-zhu` | 采、彩关系不作同一断言 |
| `evidence-pick-leaf-story` | 辨伪对照卷 | product-diagram | `source-pick-moe-variants` | 彩叶拼接越界已标出 |
| `evidence-watch-form` | 字形时间轴 | structure-diagram | `source-watch-shuowen`, `source-watch-moe-variants` | 人目器皿关系可用；无精确古字形 |
| `evidence-watch-gloss` | 字书展开卷 | product-typesetting | `source-watch-shuowen`, `source-watch-moe-variants` | 临下与现代镜义已分层 |
| `evidence-watch-mirror-relation` | 语义关系图 | product-diagram | `source-watch-moe-variants` | 监鉴关系按阶段呈现 |
| `evidence-watch-modern-story` | 辨伪对照卷 | product-diagram | `source-watch-moe-variants` | 单线照镜叙事已拆解 |
| `evidence-martial-form` | 字形时间轴 | structure-diagram | `source-martial-shuowen`, `source-martial-moe-variants`, `source-martial-csb-word-power` | 止戈关系可用；无精确古字形 |
| `evidence-martial-shuowen` | 字书展开卷 | product-typesetting | `source-martial-shuowen`, `source-martial-moe-variants` | 传统价值解释已标层级 |
| `evidence-martial-foot` | 语义关系图 | product-diagram | `source-martial-moe-variants`, `source-martial-csb-word-power` | 足、行进、停止关系已分层 |
| `evidence-martial-value-origin` | 辨伪对照卷 | product-diagram | `source-martial-moe-variants` | 价值阐释与构形证明已断线 |
| `evidence-law-old-form` | 字形时间轴 | structure-diagram | `source-law-ctext`, `source-law-moe-variants` | 灋、法层次可用；无精确古字形 |
| `evidence-law-shuowen` | 字书展开卷 | product-typesetting | `source-law-ctext`, `source-law-moe-variants` | 水、廌、去三层均保留 |
| `evidence-law-simplification` | 语义关系图 | product-diagram | `source-law-moe-variants` | 旧形与省形时序已标出 |
| `evidence-law-water-fairness` | 辨伪对照卷 | product-diagram | `source-law-moe-variants` | 截取水义的缺口已标出 |
| `evidence-autumn-variants` | 字形时间轴 | structure-diagram | `source-autumn-xiaoxue`, `source-autumn-moe-variants`, `source-autumn-ntu` | 多形并存可用；无精确古字形 |
| `evidence-autumn-insect-fire` | 字书展开卷 | product-typesetting | `source-autumn-xiaoxue`, `source-autumn-moe-variants`, `source-autumn-ntu` | 虫火材料与争议已分层 |
| `evidence-autumn-modern-form` | 语义关系图 | product-diagram | `source-autumn-moe-variants`, `source-autumn-ntu` | 现代形与原初故事已断线 |
| `evidence-autumn-debate` | 辨伪对照卷 | product-diagram | `source-autumn-moe-variants`, `source-autumn-ntu` | 竞争解释均保留缺口 |
