# 当前交付版本

仅使用 `proto-cell-20261018-v7.zip` 上传小红书小工具。

- ZIP：2,976,265 字节，80 个运行文件。
- SHA-256：`1f3012cdb90fb5341549bdec8893fd81a321ec18d748f8aaa03bf5bcebd03115`。
- 验收说明：`proto-cell-20261018-v7-验收报告.md`。
- 平台模拟器与真机待验项目：`proto-cell-20261018-v7-真机验收清单.md`。
- 机器可读结果：`proto-cell-20261018-v7-verification.json`。
- 包内文件尺寸与哈希：`proto-cell-20261018-v7-manifest.json`。

在项目目录执行 `pnpm build` 后，可运行 `python scripts/package-release.py` 重建、校验并解压最终包。解压目录属于临时校验产物，不纳入 Git。

旧版 v4 / v5 / v6、重复解压目录、生成的编译快照与重复中间截图已移入项目内 `staging-release/obsolete-20261018/`，该本地归档不提交 Git，也不包含在上传 ZIP 中。清理范围记录在 `design/cleanup-targets-2026-10-18.json`。归档保留可恢复副本，没有释放这些文件占用的磁盘空间。

此目录中的 logo 和旧版 viewport 截图属于历史设计/验收资料，原有文档仍引用它们，继续保留。最终页面可达性证据位于 `design/reachability-2026-10-18/`。

浏览器验证已完成；创服平台模拟器、Android 真机扫码和 iOS 真机扫码仍须验证同一个 SHA-256 的 ZIP，未据此声明平台已验收或发布。
