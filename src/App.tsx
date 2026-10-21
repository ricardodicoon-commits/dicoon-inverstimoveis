import { lazy, Suspense } from 'react'
import { Site } from './pages/Site'

// O CRM só é baixado quando alguém abre /app, para o site continuar leve.
const CrmApp = lazy(() => import('./crm/CrmApp'))

export default function App() {
  if (window.location.pathname.startsWith('/app')) {
    return (
      <Suspense fallback={null}>
        <CrmApp />
      </Suspense>
    )
  }
  return <Site />
}
