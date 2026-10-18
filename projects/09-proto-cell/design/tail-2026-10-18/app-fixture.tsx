import React from 'react'
import { createRoot } from 'react-dom/client'
import App from '../../src/App'
import '../../src/index.css'
;(globalThis as any).React=React
createRoot(document.getElementById('root')!).render(<App />)
