import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { prepareRuntime } from './app/bootstrap'

const root = createRoot(document.getElementById('root')!)

root.render(
  <StrictMode>
    <main aria-busy="true">正在整理任务档案……</main>
  </StrictMode>,
)

void prepareRuntime(window.localStorage).then((runtime) => {
  root.render(
    <StrictMode>
      <App content={runtime.content} catalog={runtime.catalog} bootstrapError={runtime.status === 'archive-error' ? 'archive-load' : undefined} />
    </StrictMode>,
  )
})
