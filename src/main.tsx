import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './lib/theme.tsx'
import { CompanyProvider } from './lib/company.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <CompanyProvider>
        <App />
      </CompanyProvider>
    </ThemeProvider>
  </StrictMode>,
)
