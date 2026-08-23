# 八个工程与 Codex CLI 分配

| Agent | 工作目录 | 项目 |
|---:|---|---|
| 1 | projects/01-sbti | SBTI｜山海兽格测试 |
| 2 | projects/02-wuhualu | 物华录：文物寻踪 |
| 3 | projects/03-dalisizian | 大理寺字案录 |
| 4 | projects/04-bianjing-drink-shop | 汴京饮子铺：开店一百天 |
| 5 | projects/05-relationship-manual | 我希望被这样对待｜关系说明书 |
| 6 | projects/06-departure-checker | 出门检查官 |
| 7 | projects/07-conversation-replay | 当时这样说就好了 |
| 8 | projects/08-earth-online | 地球 Online：冒险者公会大厅 |

## 启动方式

先在根目录执行一次 pnpm install。之后每个终端进入自己的项目目录运行 pnpm dev。并行开发期间不要在子项目执行依赖安装；新增依赖统一汇总到根工作区处理。

## 文件所有权

每个 Agent 只修改自己的项目目录。docs 和 prep 是只读产品资料；根 package.json、pnpm-workspace.yaml 和 pnpm-lock.yaml 由总控独占。
