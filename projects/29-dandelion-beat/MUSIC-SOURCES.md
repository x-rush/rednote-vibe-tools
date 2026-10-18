# 原游戏音乐检索记录

检索日期：2026-10-18。

- 线索：日本玩家于 2026-09-21 询问《タンポポは耐える。》最后的人类战 BGM，回答猜测为 SKUNK《West Ride》。https://detail.chiebukuro.yahoo.co.jp/qa/question_detail/q13331532673
- 音乐平台已核对到同名曲目：Apple Music 的 SKUNK《West Ride》，专辑 Clown Killi，页面标注 2024-02-07。https://music.apple.com/us/song/west-ride/1726153353
- 原作官方页面：https://store.steampowered.com/app/4368560/?l=schinese 。页面的录屏/直播许可不应当作独立游戏中的音乐素材许可。

结论：找到可试听的候选曲目，尚未以开发者曲目表、游戏 credits 或直接听音比对确认。没有取得可用于本项目的下载素材或嵌入授权，也没有购买、提取游戏音频、录制或下载音乐平台试听流。当前试玩继续使用本项目合成配乐；未声称已经替换成原曲。

若确认使用该曲并取得可嵌入游戏的音频及授权，需要重新测量 BPM、首个重拍与乐句、重编谱面、核对音频时钟与动作；不能将现有 120 BPM 的谱面直接套在曲目上。音频构建和播放仍须遵循根 AGENTS.md 的 JS 静态字节 / Web Audio 规则。

## 2026-10-18 追加：完整版来源已定位
用户已确认 SKUNK《West Ride》即目标曲目。直接读取平台公开页面/搜索接口获得以下结果，未下载音频流：

- YouTube 原版：https://www.youtube.com/watch?v=2_3DCayV_Ps 。作者 SKUNK - Topic，播放器 lengthSeconds=134，playabilityStatus=OK；说明为 Provided to YouTube by Space Shower FUGA，Released on 2024-02-07，℗2023 SKUNK。
- YouTube 伴奏版：https://www.youtube.com/watch?v=yOuq_6C07gA 。同为 SKUNK - Topic，134 秒，Space Shower FUGA 提供，2025-05-01。
- 网易云原版：https://music.163.com/#/song?id=2116070247 。公开搜索接口返回 Skunk / Clown killi / 134023ms。
- 网易云伴奏：https://music.163.com/#/song?id=2690774012 。公开搜索接口返回 SKUNK / Clown Killi (Instrumental) / 134031ms。
- QQ 原版：https://y.qq.com/n/ryqq/songDetail/002pVmzI3gWMHs 。公开搜索接口返回 SKUNK / Clown killi / 134秒，payplay=0、paydownload=1。
- QQ 伴奏：https://y.qq.com/n/ryqq/songDetail/00286CQv0exbKw 。同歌手，134秒，payplay=0、paydownload=1。

国内平台当前仅核对曲库元数据，未登录账号验证完整播放/下载权益；不把曲库时长等同于当前账号一定能完整播放。已找到完整版条目与 YouTube 可播放状态，尚无本地音频文件，项目音乐未替换。

## 原曲已获取用于本地试玩
用户明确授权后，已通过yt-dlp从上述YouTube原版取得完整音频，保存于assets/source/west-ride.webm。试玩片段assets/west-ride-preview.mp3为源10.135–50.135秒，96 BPM，40秒。此前“尚未获取文件/未替换”的描述为历史阶段，当前已接入。仅限本地试玩，未发布或上传。
