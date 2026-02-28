import { useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts'
import TopBar from '../components/Layout/TopBar'
import Toolbar from '../components/Toolbar/Toolbar'
import FloorCanvas from '../components/Canvas/FloorCanvas'
import RightPanel from '../components/Panel/RightPanel'
import StatusBar from '../components/Layout/StatusBar'
import useSaveLoad, { getLsPlans } from '../hooks/useSaveLoad'
import { getTemplate } from '../data/templates'
import useStore from '../store/useStore'

export default function Editor() {
  const { planId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { loadPlan, newPlan } = useSaveLoad()
  useKeyboardShortcuts()

  // ── Оголошуємо ДО useEffect що її використовує ──────────────
  const loadTemplate = useCallback((template) => {
    const { clearAll, addWall, addDoor, addExit, addStair, setCurrentPlanName } = useStore.getState()
    clearAll()
    setCurrentPlanName(template.name)
    template.data.walls?.forEach(w => addWall(w))
    template.data.doors?.forEach(d => addDoor(d))
    template.data.exits?.forEach(e => addExit(e))
    template.data.stairs?.forEach(s => addStair(s))
  }, [])

  useEffect(() => {
    if (planId === 'new') {
      // Якщо прийшли з Dashboard з назвою — використовуємо її
      const name = location.state?.name || 'Новий план'
      newPlan(name)
    } else if (planId?.startsWith('template/')) {
      const templateId = planId.replace('template/', '')
      const template = getTemplate(templateId)
      if (template) {
        loadTemplate(template)
      } else {
        navigate('/')
      }
    } else if (planId) {
      const plans = getLsPlans()
      // Підтримуємо як рядкові так і числові ID (локальні та бекенд)
      const plan = plans.find(p =>
        p.id === planId ||
        p.id === Number(planId) ||
        String(p.id) === String(planId)
      )
      if (plan) {
        loadPlan(plan)
      } else {
        navigate('/')
      }
    } else {
      navigate('/')
    }
  }, [planId, loadTemplate, newPlan, loadPlan, navigate, location.state])

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