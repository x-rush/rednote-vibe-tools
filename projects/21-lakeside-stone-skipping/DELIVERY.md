# 当前技术与交付

仅修改本项目，遵守根AGENTS.md的静态构建、宿主避让、安全区与音频约束。

TypeScript strict，DOM/CSS，WebGL1水面和Canvas2D石头/粒子；WebGL失败时简化水面。固定时间步模拟；localStorage只保存结构化纪录。

复用工作区TypeScript6.0.3/Rolldown1.2.5，输出Chrome61目标经典IIFE。无后端、CDN、必需外部API或Service Worker。

执行pnpm lint、pnpm test、pnpm build；检查375/390/430与横屏，非零系统安全区和宿主覆盖，真机与浏览器分别记录。ZIP根目录包含index.html、app.js、style.css，assets内含两张WebP并核对白名单。实际验证状态见PROTOTYPE.md。
