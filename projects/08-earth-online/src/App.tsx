import content from './content/content.json'
import './App.css'

function App() {
  return (
    <main className="app-shell">
      <p className="eyebrow">小红书小工具 · 工程已就绪</p>
      <h1>地球 Online：冒险者公会大厅</h1>
      <p>当前只提供可构建的开发骨架。正式 UI、玩法逻辑与首发内容由本项目 Codex CLI 按项目文档实现。</p>
      <dl>
        <div><dt>项目 ID</dt><dd>{content.projectId}</dd></div>
        <div><dt>内容版本</dt><dd>{content.contentVersion}</dd></div>
      </dl>
    </main>
  )
}

export default App
