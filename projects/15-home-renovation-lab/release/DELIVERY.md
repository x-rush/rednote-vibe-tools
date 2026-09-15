# 小红书容器 ZIP 交付说明

本次使用仓库 `.codex/SKILL.md` 中的 `minitool-zip-builder` v1.6.0 进行适配、审计和打包。

上传文件：`roomish-1.0.0-minitool.zip`。入口 `index.html` 直接位于 ZIP 根目录，所有脚本、样式、家具缩略图、图标和第三方许可证均在包内。

## 容器适配

- 生成经典 IIFE 脚本，移除 module、动态 import、顶层 await 和运行期 fetch。
- 使用工作区已有 TypeScript / Rolldown / PostCSS 工具，转译为 ES2017 / Chrome 61 语法目标，未安装新依赖。
- 目录数据生成独立本地经典脚本；26 张家具缩略图预先渲染为 PNG，避免首屏再建立额外 WebGL 上下文。
- 容器禁止文件下载，因此方案与 CSV 清单改为可选中的文本；JSON 通过页内粘贴导入，不调用仅能选图片 / 视频的系统文件选择器。
- 图片在页内预览，用户点击后才调用文档规定的 `window.xhs.miniTool.saveImageToPhotosAlbum({filePath})`。没有原生接口时仍可查看图片，不假报保存成功。
- 导出图片限制边长和短暂 Base64 的解码体积；不持久化图片、Base64 或 Blob。
- Chrome 61 基线提供 viewport、物理定位、焦点、Flex margin 和局部 Web API 回退，安全区兼容容器注入变量。
- WebGL 默认关闭动态阴影，合并静态几何，限制 DPR 与像素总量。持续超预算时降档；WebGL 不可用、上下文丢失或最低档仍超预算时切换可编辑的 Canvas 2D 平面视图。
- 页面隐藏暂停动画；降级时释放 GPU 几何、材质、纹理和渲染器。

## 验收

`container-check.json` 记录以下现代 Chromium 测试：本地 file 加载、严格 CSP、禁用 fetch 和部分新 API、WebGL 不可用、强制 Flex margin 回退、375 / 390 / 430 CSS px，以及 28px 顶部 + 16px 底部模拟安全区。

相册调用使用契约 mock 验证，未向真实相册写入图片。默认场景的测试环境记录为 30 次绘制调用、18106 个三角形、6 张纹理；这些数字不代表真机帧率或峰值内存。

Skill 提供的目录和 ZIP 体积审计均通过，零警告。另检查 ZIP 根入口、允许的文件类型及 CRC 完整性。

**尚未实测：Chrome 61 / Android 8.1 真机、iOS 真机、真实容器 JSBridge、真机 FPS 和内存。** 旧语法、API 与布局回退经过静态和模拟检查，不等同于上述设备已通过。

## 复现

在项目目录使用 Node.js 22+，并保留当前工作区现有构建工具：

```sh
node scripts/package-minitool.mjs
node ../../.codex/scripts/audit_artifact.mjs minitool-dist
node ../../.codex/scripts/audit_artifact.mjs release/roomish-1.0.0-minitool.zip
```

`packaging-assets/furniture/` 已提供本次生成的完整缩略图。若重新生成美术，使用 `scripts/package-art.mjs`，通过 `PLAYWRIGHT_PACKAGE` 指定现有 Playwright 路径，并以 `ART_SOURCE_URL` 指向普通网页预览。

容器构建位于 `minitool-dist/`，普通网页构建仍位于 `dist/`；两者的导入导出方式不同。
