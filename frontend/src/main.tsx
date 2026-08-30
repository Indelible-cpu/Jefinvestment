import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.tsx'
import { initPWAUpdate } from './utils/pwaUpdate'

// Register PWA service worker and notify when system updates are available
initPWAUpdate();

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  </StrictMode>,
)
// v2
// Final deploy trigger
// Triggering final deploy
// Trigger frontend build with correct worker URL
// Triggering after setting secret in Github
// Deploy with GitHub secret API URL
// Fresh deploy to jefinvestment.pages.dev
