import TopBar from './components/Layout/TopBar'
import Toolbar from './components/Toolbar/Toolbar'
import FloorCanvas from './components/Canvas/FloorCanvas'
import RightPanel from './components/Panel/RightPanel'
import StatusBar from './components/Layout/StatusBar'

export default function App() {
  return (
    <div className="flex flex-col h-screen bg-white text-[#1a1a1a] overflow-hidden">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Toolbar />
        <FloorCanvas />
        <RightPanel />
      </div>
      <StatusBar />
    </div>
  )
}