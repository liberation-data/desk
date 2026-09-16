import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { App } from './app.js'

// Hot reload re-runs this module; reuse the root rather than creating a second one on the same container.
const container = document.getElementById('root') as (HTMLElement & { reactRoot?: Root }) | null
if (container) {
  container.reactRoot ??= createRoot(container)
  container.reactRoot.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
