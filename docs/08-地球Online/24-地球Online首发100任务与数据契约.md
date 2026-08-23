# 地球 Online：冒险者公会大厅｜首发 100 任务与数据契约

状态：CONTENT READY / 待转 JSON、重复度盲审与筛选自动测试。

主文案：`主线不用着急，先来领一个小任务。`

## 1. 通用约束

- 全部首发任务预算上限为 0 元，不诱导消费。
- 不要求上传照片；“观察”“记录”都可只在心里完成或写短文本。
- 不调用定位、地图、天气或通讯录。
- 户外任务只允许白天、熟悉且公开安全的区域，并可随时换成室内回退任务。
- 不要求接触陌生人、进入封闭/废弃/禁止区域、违规穿越道路或做高强度运动。
- 身体活动均用“舒适范围”“如不适合请跳过”，不作为医疗建议。
- 完成和放弃都不扣分，不设置连续签到压力。

字段缩写：分钟 `min`；精力 `E1/E2/E3`；环境 `I` 室内、`O` 户外、`IO` 均可；时间 `A` 任意、`D` 白天、`N` 夜间也安全；社交 `S` 独处、`P` 可选与熟人互动。

## 2. 恢复精力：Q001–Q010

| ID | 任务 | min | 精力 | 环境 | 时间 | 社交 |
|---|---|---:|---|---|---|---|
| quest-rest-window-color | 看窗外五分钟，记住今天天空或光线的一种颜色 | 5 | E1 | I | A | S |
| quest-rest-water-pause | 喝一杯水，把屏幕放下三分钟 | 5 | E1 | I | A | S |
| quest-rest-chair-reset | 调整座椅和桌面，让身体舒服一点 | 5 | E1 | I | A | S |
| quest-rest-slow-song | 选一首舒缓的歌，只听完这一首 | 5 | E1 | I | A | S |
| quest-rest-close-eyes | 在安全坐姿下闭眼休息两分钟，再慢慢睁开 | 5 | E1 | I | A | S |
| quest-rest-warm-light | 关掉一处刺眼光源，重新安排更舒服的照明 | 5 | E1 | I | N | S |
| quest-rest-breath-space | 不改变呼吸，只观察十次自然呼吸的开始与结束 | 5 | E1 | I | A | S |
| quest-rest-hands | 洗手或用温水让双手休息片刻 | 5 | E1 | I | A | S |
| quest-rest-silent-minute | 给自己一分钟不输入、不阅读、不处理任何消息 | 5 | E1 | IO | A | S |
| quest-rest-name-enough | 写下今天已经完成的一件小事，并允许它算数 | 5 | E1 | I | A | S |

## 3. 整理生活：Q011–Q020

| ID | 任务 | min | 精力 | 环境 | 时间 | 社交 |
|---|---|---:|---|---|---|---|
| quest-tidy-palm-surface | 清理一个手掌大小的平面 | 10 | E1 | I | A | S |
| quest-tidy-five-items | 把眼前五件东西放回更合适的位置 | 10 | E1 | I | A | S |
| quest-tidy-one-drawer | 只整理一个小抽屉，不扩大范围 | 15 | E2 | I | A | S |
| quest-tidy-downloads | 删除或归档下载目录中五个明确无用的文件 | 10 | E1 | I | A | S |
| quest-tidy-desktop | 让电脑或手机首页只保留今天常用的入口 | 10 | E1 | I | A | S |
| quest-tidy-bag | 从常用包里拿出三件已经不需要的东西 | 10 | E1 | I | A | S |
| quest-tidy-cables | 理顺一处线缆，确认没有明显破损 | 10 | E2 | I | A | S |
| quest-tidy-expired-note | 清掉一条已经失效的提醒或便签 | 5 | E1 | I | A | S |
| quest-tidy-fridge-zone | 只检查冰箱一个区域，把需要尽快使用的放到前面 | 10 | E2 | I | A | S |
| quest-tidy-tomorrow-item | 把明天最重要的一件物品放到容易看见的位置 | 5 | E1 | I | N | S |

## 4. 观察附近：Q021–Q030

| ID | 任务 | min | 精力 | 环境 | 时间 | 社交 |
|---|---|---:|---|---|---|---|
| quest-observe-three-colors | 找到身边三种以前没注意的颜色组合 | 10 | E1 | IO | A | S |
| quest-observe-shadow | 观察一个影子五分钟里怎样改变 | 5 | E1 | IO | D | S |
| quest-observe-building-detail | 在熟悉的建筑里找一个一直没注意的细节 | 10 | E1 | IO | D | S |
| quest-observe-sound-layers | 安静听一分钟，分辨近处、中间和远处的声音 | 5 | E1 | IO | A | S |
| quest-observe-letter-shape | 找三个设计不同的汉字或字母招牌，只看形状 | 10 | E1 | IO | D | S |
| quest-observe-green | 找到附近三种不同形状的叶子或植物轮廓，不采摘 | 10 | E1 | IO | D | S |
| quest-observe-reflection | 找一处安全的反光表面，观察它改变了什么 | 5 | E1 | IO | A | S |
| quest-observe-weather-without-app | 不看天气应用，先观察云、光和风，再核对自己的感受 | 5 | E1 | IO | D | S |
| quest-observe-worn-object | 找一件有使用痕迹的物品，猜它最常被怎样使用 | 10 | E1 | I | A | S |
| quest-observe-room-route | 用目光走一遍从座位到门口的路线，发现一个障碍物 | 5 | E1 | I | A | S |

## 5. 轻微运动：Q031–Q040

| ID | 任务 | min | 精力 | 环境 | 时间 | 社交 |
|---|---|---:|---|---|---|---|
| quest-move-short-walk | 在安全熟悉的路线舒适地走十分钟 | 10 | E2 | O | D | S |
| quest-move-three-stretches | 选三个自己熟悉且舒服的轻柔动作活动身体 | 5 | E1 | I | A | S |
| quest-move-room-lap | 在室内安全区域慢慢走几圈，中途随时可停 | 5 | E1 | I | A | S |
| quest-move-one-song | 放一首歌，在舒适范围内跟着节奏动一动 | 5 | E2 | I | A | S |
| quest-move-stairs-optional | 如果身体与环境适合，少乘一小段电梯并走一层楼梯 | 5 | E2 | I | D | S |
| quest-move-posture-change | 离开同一姿势，换一个地方站立或坐五分钟 | 5 | E1 | I | A | S |
| quest-move-carry-light | 把一件轻物品从一个房间送回它的位置 | 5 | E1 | I | A | S |
| quest-move-balance-support | 扶稳固物体，在舒适范围轮流抬脚几秒；不适合就跳过 | 5 | E2 | I | A | S |
| quest-move-walk-listen | 在熟悉路线散步，只留意脚步和环境声音 | 10 | E2 | O | D | S |
| quest-move-reset-break | 为久坐设置一次十分钟后的起身提醒，并按时起来 | 15 | E1 | I | A | S |

## 6. 创造一点东西：Q041–Q050

| ID | 任务 | min | 精力 | 环境 | 时间 | 社交 |
|---|---|---:|---|---|---|---|
| quest-create-paper-creature | 用废纸画或折一只不存在的小生物 | 15 | E2 | I | A | S |
| quest-create-four-line-story | 写一个只有四行、必须出现“门”和“风”的故事 | 10 | E2 | I | A | S |
| quest-create-color-name | 给今天看到的一种颜色起一个自己的名字 | 5 | E1 | IO | A | S |
| quest-create-object-title | 给身边一件普通物品取一个博物馆展品名 | 5 | E1 | I | A | S |
| quest-create-menu | 用现有饮品或食物写一张三项幻想菜单，不必制作 | 10 | E1 | I | A | S |
| quest-create-sound-map | 用点和线画出刚才听见的三层声音 | 10 | E2 | I | A | S |
| quest-create-tiny-poem | 用眼前第一件物品写三句不押韵的小诗 | 10 | E2 | I | A | S |
| quest-create-new-rule | 给一个熟悉小游戏发明一条不伤害任何人的新规则 | 10 | E2 | I | A | S |
| quest-create-paper-window | 在纸上画一扇窗，再画窗外不可能出现的景色 | 15 | E2 | I | A | S |
| quest-create-title-today | 不写日记，只给今天取一个标题 | 5 | E1 | I | N | S |

## 7. 学习与好奇：Q051–Q060

| ID | 任务 | min | 精力 | 环境 | 时间 | 社交 |
|---|---|---:|---|---|---|---|
| quest-learn-one-page | 读手边材料的一页，记下一个新词 | 10 | E1 | I | A | S |
| quest-learn-object-origin | 查清身边一种普通物品名称的由来，只看一个可靠来源 | 15 | E2 | I | A | S |
| quest-learn-map-memory | 不打开地图，先画出家到熟悉地点的路线，再核对 | 15 | E2 | I | A | S |
| quest-learn-three-words | 学会一种语言里三个日常词，并读出声 | 10 | E2 | I | A | S |
| quest-learn-label | 读懂一个产品标签上的三个字段代表什么 | 10 | E1 | I | A | S |
| quest-learn-museum-object | 从可靠博物馆页面认识一件文物，只记一个特征 | 15 | E2 | I | A | S |
| quest-learn-constellation-shape | 在资料中认识一个星座的形状，不要求夜间外出观察 | 10 | E1 | I | A | S |
| quest-learn-keyboard-shortcut | 学一个自己真正会用到的键盘快捷键并试一次 | 5 | E1 | I | A | S |
| quest-learn-houseplant | 查清身边一种植物的名称；不确定时只记录候选 | 15 | E2 | IO | D | S |
| quest-learn-question | 写下一个最近真的好奇的问题，再把它缩小一半 | 10 | E2 | I | A | S |

## 8. 联系熟悉的人：Q061–Q070

| ID | 任务 | min | 精力 | 环境 | 时间 | 社交 |
|---|---|---:|---|---|---|---|
| quest-connect-thanks | 给熟悉的人发一句具体感谢，不要求回复 | 10 | E2 | I | A | P |
| quest-connect-memory | 问熟悉的人是否记得一件共同小事；不方便就只写下来 | 10 | E2 | I | A | P |
| quest-connect-recommend | 把最近喜欢的一首歌、文章或食物推荐给熟悉的人 | 10 | E2 | I | A | P |
| quest-connect-check-in | 给久未联系但关系安全的人发一句不施加回复压力的问候 | 10 | E2 | I | D | P |
| quest-connect-voice-note | 给愿意收语音的熟人录一段一分钟近况；发送前可重听或放弃 | 10 | E2 | I | A | P |
| quest-connect-question | 向熟悉的人问一个你确实想听答案的小问题 | 10 | E2 | I | A | P |
| quest-connect-photo-memory-no-upload | 看一张自己的旧照片，想起同行的人；不要求上传或发送 | 5 | E1 | I | A | S |
| quest-connect-plan-small | 邀请熟悉的人约一个低压力的小活动，也允许对方拒绝 | 10 | E2 | I | D | P |
| quest-connect-acknowledge | 对最近得到的一次帮助补一句具体确认 | 10 | E2 | I | A | P |
| quest-connect-unsent-letter | 写三句想对熟悉的人说的话，可以不发送 | 10 | E1 | I | A | S |

## 9. 善意与共用空间：Q071–Q080

| ID | 任务 | min | 精力 | 环境 | 时间 | 社交 |
|---|---|---:|---|---|---|---|
| quest-kind-reset | 把共用空间里一件东西放回合适位置 | 5 | E1 | I | A | S |
| quest-kind-refill | 在自己有责任的范围内补充一项共用消耗品 | 10 | E1 | I | A | S |
| quest-kind-clear-path | 移开自己放在通道上的一个障碍物 | 5 | E1 | I | A | S |
| quest-kind-clean-small | 清洁一处自己使用后留下的小区域 | 5 | E1 | I | A | S |
| quest-kind-label | 给容易拿错的一件共用物品加清楚文字标签 | 10 | E1 | I | A | S |
| quest-kind-return-cart | 如果刚好使用购物车或共享物品，把它归还指定位置 | 5 | E1 | IO | D | S |
| quest-kind-quiet-setting | 在共用空间检查一次自己的声音或提示音是否过大 | 5 | E1 | IO | A | S |
| quest-kind-information | 把一条对团队有用且确认无误的信息放到约定位置 | 10 | E2 | I | A | P |
| quest-kind-thank-worker | 在自然发生服务互动时真诚说一句谢谢，不额外打扰 | 5 | E1 | IO | D | P |
| quest-kind-leave-better | 离开一个自己使用的地方前，让它比来时整齐一点 | 5 | E1 | IO | A | S |

## 10. 数字生活：Q081–Q090

| ID | 任务 | min | 精力 | 环境 | 时间 | 社交 |
|---|---|---:|---|---|---|---|
| quest-digital-one-notification | 关闭一个长期没有价值的非必要通知 | 5 | E1 | I | A | S |
| quest-digital-home-screen | 把一个最常用工具放到更容易找到的位置 | 5 | E1 | I | A | S |
| quest-digital-delete-five | 删除五张明确无用的截图或重复文件；不批量误删 | 10 | E1 | I | A | S |
| quest-digital-name-file | 给一个重要但命名混乱的文件改成可搜索的名称 | 5 | E1 | I | A | S |
| quest-digital-backup-check | 只检查一项重要资料是否已有可用备份，不上传新隐私 | 10 | E2 | I | A | S |
| quest-digital-unsubscribe | 取消一个确定不再需要的正规订阅邮件或消息 | 10 | E1 | I | A | S |
| quest-digital-tab-five | 关闭或收藏五个已经不需要同时打开的标签页 | 5 | E1 | I | A | S |
| quest-digital-password-plan | 列出一个需要更新安全设置的账号；不在任务日志写密码 | 5 | E1 | I | A | S |
| quest-digital-focus-slot | 设一个十分钟勿扰时段，结束后自动恢复 | 10 | E1 | I | A | S |
| quest-digital-download-folder | 把下载目录中三个文件归到正确位置 | 10 | E1 | I | A | S |

## 11. 微型冒险：Q091–Q100

| ID | 任务 | min | 精力 | 环境 | 时间 | 社交 |
|---|---|---:|---|---|---|---|
| quest-adventure-new-turn | 白天在熟悉安全区域选择一个以前没走的小转角 | 15 | E2 | O | D | S |
| quest-adventure-floor | 在允许进入的熟悉建筑里去一个平常很少经过的公共楼层 | 10 | E2 | I | D | S |
| quest-adventure-reverse-route | 用相反顺序走一遍熟悉且安全的室内路线 | 10 | E1 | I | A | S |
| quest-adventure-color-hunt | 出门或在室内寻找五个同色但不同用途的物品 | 15 | E2 | IO | D | S |
| quest-adventure-sign-story | 选一个熟悉区域的旧招牌，想象它见过的一天 | 10 | E1 | IO | D | S |
| quest-adventure-door-count | 在安全公共路线数一数十扇不同的门，不进入私人区域 | 10 | E1 | IO | D | S |
| quest-adventure-bench-pause | 白天在熟悉公开地点找安全座位停留五分钟 | 10 | E1 | O | D | S |
| quest-adventure-no-headphones | 在熟悉安全的短路线暂时不戴耳机，留意环境声音 | 10 | E2 | O | D | S |
| quest-adventure-three-landmarks | 找出熟悉路线上的三个方向标记，想象如何说给朋友听 | 10 | E1 | O | D | S |
| quest-adventure-tiny-souvenir | 从旅程带回一个不占空间的文字记忆，不捡走自然或公共物品 | 10 | E1 | IO | D | S |

## 12. 等级分配

- E 级：5–10 分钟、E1、步骤 1–2 个，共约 55 项。
- D 级：10–20 分钟或 E2、步骤 2–3 个，共约 45 项。
- C 级首发只作为未来标签，不生成高风险或高强度任务；MVP 的 100 项均为 E/D。

等级不是用户能力和价值评价，只代表任务投入。

## 13. 安全标签

```text
safe-indoor
daylight-only
familiar-area-only
public-area-only
comfort-range
optional-social
no-photo-required
no-personal-data
no-purchase
skip-if-unsuitable
```

户外任务至少带 `daylight-only + familiar-area-only + public-area-only`。身体活动至少带 `comfort-range + skip-if-unsuitable`。数字安全任务带 `no-personal-data`。

## 14. 筛选与权重

```ts
eligible =
  minutes <= status.minutes
  && energy <= status.energy
  && maxCost <= status.budget
  && environment matches
  && time matches
  && all safety predicates pass;

weight =
  goalMatch * 4
  + unusedRecently * 3
  + energyCloseness * 2
  + favoriteBonus
  - unsuitablePenalty
  - cooldownPenalty;
```

- 硬过滤在权重计算前执行，权重不能恢复被过滤任务。
- 最近完成 7 天或最近展示 3 次内的任务进入冷却。
- `不适合我` 每次降低权重，不永久删除；设置页可重置反馈。
- 过滤为空时，从 `safe-indoor + E1 + 0元 + 5分钟` 回退池选择，并说明已放宽“目标匹配”，不放宽安全条件。

## 15. 精确数据契约

```ts
type EarthOnlineContent = {
  ranks: Rank[];
  goals: Goal[];
  questCategories: QuestCategory[];
  quests: Quest[];
  safetyRules: SafetyRule[];
  fallbackRules: FallbackRule[];
};

type Quest = {
  id: string;
  categoryId: string;
  title: string;
  rank: "E" | "D";
  minutes: 5 | 10 | 15 | 20;
  maxCost: 0;
  energy: 1 | 2;
  environments: ("indoor" | "outdoor")[];
  social: "solo" | "optional";
  times: ("day" | "night")[];
  goalIds: string[];
  steps: string[];
  completionText: string;
  safetyTags: string[];
  cooldownDays: number;
};
```

## 16. 内容验收

- 恰好 100 个唯一任务 ID。
- 每个任务 0 元、5–20 分钟、E1/E2。
- 十个类别各 10 个，不以一个类别填充数量。
- 户外任务全部白天、熟悉且公开安全区域。
- 不含拍照上传、陌生人挑战、危险地点、医学建议、极端运动、违法和羞辱任务。
- 任何条件组合空池时都有室内低精力回退。
- 连续展示测试不会三次内重复同一任务。
