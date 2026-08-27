import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { SourceProvider } from './api'
import './theme.css'

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      // A fleet dashboard is mostly reads that go stale quickly. Until the
      // server's WS /api/v1/events exists, refetching on an interval is the
      // honest stand-in -- see README, it does not scale and is a placeholder.
      refetchInterval: 2000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <SourceProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </SourceProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
