import { messages } from './content/messages'

export function App() {
  return (
    <main className="app-shell">
      <p>{messages[0]?.text}</p>
    </main>
  )
}
