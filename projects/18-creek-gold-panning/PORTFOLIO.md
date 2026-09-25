# 五个户外项目 · 当前交付索引

2026-09-19。五项均有可运行代码、测试、静态构建和独立 ZIP；不是仅立项文档。当前为浏览器验收版本，小红书真机和长时间性能验收仍待完成。

| 项目 | 本地预览 | 测试 | 最新离线包 |
|---|---|---:|---|
| 溪边淘金 | http://127.0.0.1:4322/ | 55 | [creek-gold-panning.zip](../18-creek-gold-panning/release/creek-gold-panning.zip)，3.14 MiB |
| 雨后找菌子 | http://127.0.0.1:4323/ | 41 | [rainy-mushroom-hunt.zip](../19-rainy-mushroom-hunt/release/rainy-mushroom-hunt.zip)，2.66 MiB |
| 退潮赶海 | http://127.0.0.1:4324/ | 36 | [tidal-beachcombing.zip](../20-tidal-beachcombing/release/tidal-beachcombing.zip)，1.78 MiB |
| 湖边打水漂 | http://127.0.0.1:4321/ | 14 | [lakeside-stone-skipping.zip](../21-lakeside-stone-skipping/release/lakeside-stone-skipping.zip)，0.57 MiB |
| 野塘钓鱼 | http://127.0.0.1:4325/ | 38 | [wild-pond-fishing.zip](../22-wild-pond-fishing/release/wild-pond-fishing.zip)，0.66 MiB |

合计 184 项测试。五个项目 lint / test / build 均通过，dist 与最终 ZIP 审计均通过。淘金与找菌子超过 2 MiB 建议体积但低于 10 MiB 硬限制。

每个项目的 CURRENT-IMPLEMENTATION.md 记录实际范围，qa/CURRENT-RELEASE.md 与 release/manifest.json 记录最新包证据。设计文档中的全部高级目标不能仅凭此索引视为完成。
