import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { AppStoreProvider, useStore } from './state/AppStore'
import { useBoot } from './components/layout/Boot'
import Login from './screens/Login'
import './styles/index.css'

// Login landing until the analyst signs in and the offline tiles are ready.
function Gate() {
  const { session } = useStore()
  const boot = useBoot()
  if (session && boot.ready) return <App />
  return <Login boot={boot} />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AppStoreProvider>
        <Gate />
      </AppStoreProvider>
    </HashRouter>
  </React.StrictMode>,
)
