import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Shell } from './components/layout/Shell'
import Ask from './screens/Ask'
import Theatre from './screens/Theatre'
import Workspace from './screens/Workspace'
import ReviewQueue from './screens/review/ReviewQueue'
import SiteDossier from './screens/SiteDossier'
import Watches from './screens/Watches'
import GapsDigest from './screens/GapsDigest'
import Handoff from './screens/Handoff'
import Audit from './screens/Audit'

export default function App() {
  const { pathname } = useLocation()
  return (
    <Shell>
      {/* keyed wrapper = one fluid entrance per screen */}
      <div key={pathname.split('/')[1]} className="route-in flex-1 min-h-0 flex flex-col">
      <Routes>
        <Route path="/" element={<Navigate to="/theatre" replace />} />
        <Route path="/theatre" element={<Theatre />} />
        <Route path="/workspace" element={<Workspace />} />
        <Route path="/ask" element={<Ask />} />
        <Route path="/review" element={<ReviewQueue />} />
        <Route path="/sites" element={<SiteDossier />} />
        <Route path="/sites/:id" element={<SiteDossier />} />
        <Route path="/watches" element={<Watches />} />
        <Route path="/gaps" element={<GapsDigest />} />
        <Route path="/handoff" element={<Handoff />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="*" element={<Navigate to="/theatre" replace />} />
      </Routes>
      </div>
    </Shell>
  )
}
