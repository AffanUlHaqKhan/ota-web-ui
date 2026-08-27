import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { SourceSwitch } from './components/SourceSwitch'
import Fleet from './pages/Fleet'
import DeviceDetail from './pages/DeviceDetail'
import Targets from './pages/Targets'
import Rollouts from './pages/Rollouts'
import RolloutDetail from './pages/RolloutDetail'

const NAV = [
  { to: '/fleet', label: 'Fleet' },
  { to: '/targets', label: 'Builds' },
  { to: '/rollouts', label: 'Rollouts' },
]

export default function App() {
  return (
    <div className="app">
      <aside className="sidebar">
        <h1>OTA</h1>
        <nav>
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to}
              className={({ isActive }) => (isActive ? 'active' : '')}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <SourceSwitch />
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Navigate to="/fleet" replace />} />
          <Route path="/fleet" element={<Fleet />} />
          <Route path="/devices/:id" element={<DeviceDetail />} />
          <Route path="/targets" element={<Targets />} />
          <Route path="/rollouts" element={<Rollouts />} />
          <Route path="/rollouts/:id" element={<RolloutDetail />} />
        </Routes>
      </main>
    </div>
  )
}
