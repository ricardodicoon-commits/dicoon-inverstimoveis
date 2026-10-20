import { Site } from './pages/Site'
import { AreaCliente } from './pages/AreaCliente'

// O CRM ficará em /app; até ele ser reconstruído, mostra um aviso.
export default function App() {
  const ehApp = window.location.pathname.startsWith('/app')
  return ehApp ? <AreaCliente /> : <Site />
}
