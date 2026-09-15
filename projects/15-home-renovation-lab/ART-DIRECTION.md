# 美术与第三方资源记录

## 本项目原创

品牌：住进想象 / ROOMISH。视觉方向：温暖的模型工作台，鼠尾草绿、纸白与陶土色，低多边形家具搭配柔和日照。

- 家具：`src/scene.js` 中的 `furnitureModel`，26 款配置由基础几何、圆角挤出和组合结构生成。
- 材质：同文件的 `texture`，通过确定性噪点、木纹曲线、砖缝及条纹绘制生成。
- 缩略图：同一 3D 模型离屏渲染，保证目录与实物外形一致；不持久化 Base64。
- 品牌图标：`src/brand.svg`。
- 户型预览：根据实际房间轮廓动态生成 SVG。
- UI 图标：本项目 SVG 路径。

以上资源不需要运行时网络服务或在线图片库。

## Three.js

版本：0.186.0。

来源：官方 npm 注册表 `https://registry.npmjs.org/three`。

使用文件：`build/three.module.js`、`build/three.core.js`、`examples/jsm/controls/OrbitControls.js`。

许可证：MIT，完整版权声明与许可证保留在 `src/vendor/package/LICENSE`。

本地适配：OrbitControls 的 `from 'three'` 改为本地相对路径；未改动库实现。

技术参考：

- https://threejs.org/docs/pages/OrbitControls.html
- https://threejs.org/docs/pages/Raycaster.html
- https://threejs.org/docs/pages/CanvasTexture.html

无下载的品牌家具模型、商业纹理或第三方摄影素材。
