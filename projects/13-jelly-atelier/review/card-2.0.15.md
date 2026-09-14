# 纸品卡片 2.0.15

奶油信纸与莓粉明信片两种本地 Canvas 版式，真实果冻、1080×1440 输出；文字自动换行，纸纹固定随机种子。tests/visual-card.html 可并排查看完整成图。

保存相册契约依据根 .codex/SKILL.md 及 references/jsbridge-api.md。仓库与本机技能目录未找到单独名为rednote的技能。优先 writeTempFile({data:完整PNG data URI})，再 saveImageToPhotosAlbum({filePath})；临时文件API缺失时使用规范支持的数据URI。没有使用下载链接、外部服务或持久存储图片。

验证：43项测试、lint/build、离线包审计通过。完整成图视觉检查，375×667、390×844、430×844模拟44px安全区，样式切换、编辑留言、普通浏览器保存提示及底部按钮可达；无控制台error。小红书真机权限及原生相册写入、Chrome61兼容性尚未实测。
