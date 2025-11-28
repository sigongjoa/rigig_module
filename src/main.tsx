import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import RiggingTest from './RiggingTest.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RiggingTest />
  </StrictMode>,
)
