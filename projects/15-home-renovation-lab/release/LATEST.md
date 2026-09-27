# 当前交付版本

2026-09-27：ROOMISH 1.4.0。

上传 `roomish-1.4.0-minitool.zip`（1,355,602 字节，约 1.36 MB，62 文件，`index.html` 位于 ZIP 根目录）。
SHA256：`9d8ec5bba2c3fc5f894b3915e212f7e8f2a9b9acaba8dd5a85fca7567966ea5f`。

skill 审计（minitool-zip-builder v1.7 / audit_artifact.mjs）：目录 PASS（62 文件 0 警告）、ZIP 体积 PASS（0 警告）。产物合规：扩展名仅 html/css/js/json/png；无内联脚本与行内事件；无 fetch/XHR/Worker/eval/WebAssembly/定位/剪贴板/window.open；CSS 无 dvh/inset 残留（Chrome 61 基线已由打包转换）；JS 为 ES2017 转译产物，无 import/export 残留。验收记录见 `acceptance-1.4.0.json`；审计与验证明细见 `../artifacts/budget-audit-20260927/`。

待用户验证：创服平台模拟器完整功能验证、Android 真机扫码验证、iOS 真机扫码验证（均须使用本 zip 同一产物）。

本版要点：家具目录扩充至 56 件；新手模式可直接调节家具尺寸与门窗尺寸；四种窗户类型（1.3.1 起）；整墙/透视矮墙两档切换（1.3.3 起）；大方案不再误降级为平面视图（1.3.0 起）。

旧 1.1.0 / 1.2.0 / 1.3.x ZIP 不包含本版全部功能，不要继续上传旧包。
