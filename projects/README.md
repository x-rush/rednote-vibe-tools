# 工程索引与协作分工

当前 14 个工程统一编号为 01–14，与 [文档索引](../docs/README.md) 对齐。编号表示项目目录顺序，不表示当前 Agent 分配或发布顺序。

| 编号 | 项目 | 工程目录 |
|---|---|---|
| 01 | SBTI · 山海兽格测试 | [01-sbti](./01-sbti/) |
| 02 | 器华录：文物寻踪 | [02-wuhualu](./02-wuhualu/) |
| 03 | 大理寺字案录 | [03-dalisizian](./03-dalisizian/) |
| 04 | 汴京饮子铺：开店一百天 | [04-bianjing-drink-shop](./04-bianjing-drink-shop/) |
| 05 | 我希望被这样对待 · 关系说明书 | [05-relationship-manual](./05-relationship-manual/) |
| 06 | 出门检查官 | [06-departure-checker](./06-departure-checker/) |
| 07 | 当时这样说就好了 | [07-conversation-replay](./07-conversation-replay/) |
| 08 | 地球 Online：冒险者公会大厅 | [08-earth-online](./08-earth-online/) |
| 09 | 原生：一滴水的战争 | [09-proto-cell](./09-proto-cell/) |
| 10 | 鱼戏莲叶间 | [10-fish-among-lotus](./10-fish-among-lotus/) |
| 11 | 星风来信 | [11-starwind-letter](./11-starwind-letter/) |
| 12 | 番茄小院 | [12-tomato-garden](./12-tomato-garden/) |
| 13 | 果冻慢慢 | [13-jelly-atelier](./13-jelly-atelier/) |
| 14 | 武林外传：同福客栈风波再起 | [14-tongfu-rhythm](./14-tongfu-rhythm/) |

## 启动方式

先在根目录执行一次 `pnpm install`。之后进入所选项目目录运行 `pnpm dev`，访问终端输出的地址。不同项目的构建与打包方式以项目 README 和 package.json 为准。

## 文件所有权

并行开发时，每个 Agent 只修改分配给自己的项目目录，并先阅读根目录及项目内的 AGENTS.md。新增依赖由总控统一处理，避免并行修改根锁文件。

## 编号规则

工程目录与 docs 中的项目目录使用相同编号，新增项目从 15 起继续递增。docs/00-总控与共用是公共资料，不占项目编号。历史文档文件名中的编号、版本号、业务 ID 和开发端口不随目录编号调整。
