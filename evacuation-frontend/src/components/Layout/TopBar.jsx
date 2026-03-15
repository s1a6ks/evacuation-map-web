import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../../store/useStore'
import useSaveLoad, { getLsPlans } from '../../hooks/useSaveLoad'

export default function TopBar() {
  const navigate = useNavigate()
  const {
    mode, setMode, viewMode, setViewMode,
    currentPlanName, isSaving, autoSave, setAutoSave, walls,
    undo, history,
  } = useStore()
  const { save, loadPlan, newPlan, lastSavedLabel } = useSaveLoad()

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [plans, setPlans] = useState([])
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(currentPlanName)
  const [newPlanInput, setNewPlanInput] = useState(false)
  const [newPlanName, setNewPlanName] = useState('')
  const [backendOnline, setBackendOnline] = useState(null)

  const checkBackend = useCallback(async () => {
    try {
      const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5135/api'
      const res = await fetch(`${BASE}/buildings`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(2000),
      })
      setBackendOnline(res.ok || res.status === 405)
    } catch {
      setBackendOnline(false)
    }
  }, [])

  useEffect(() => {
    checkBackend()
    const interval = setInterval(checkBackend, 5000)
    return () => clearInterval(interval)
  }, [checkBackend])

  const dropdownRef = useRef(null)
  const nameRef = useRef(null)

  const openDropdown = () => {
    setPlans(getLsPlans())
    setDropdownOpen(true)
  }

  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e) => {
      if (!dropdownRef.current?.contains(e.target)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  useEffect(() => { setNameInput(currentPlanName) }, [currentPlanName])

  const handleNameSubmit = () => {
    setEditingName(false)
    useStore.getState().setCurrentPlanName(nameInput || 'Без назви')
  }

  const handleNewPlan = () => {
    const name = newPlanName.trim() || 'Новий план'
    newPlan(name)
    setNewPlanInput(false)
    setNewPlanName('')
    setDropdownOpen(false)
  }

  const handleLoad = (plan) => {
    loadPlan(plan)
    setDropdownOpen(false)
  }

  const formatDate = (iso) => {
    const d = new Date(iso)
    return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })
      + ' ' + d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
  }

  const hasUnsaved = walls.length > 0 && !lastSavedLabel

  return (
    <div className="bg-[#f7f7f7] border-b border-[#e5e5e5] flex-shrink-0 select-none">

      {/* ── Row 1 ── */}
      <div className="h-[48px] flex items-center px-4 relative">

        {/* Back button */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 px-2 py-[4px] rounded-md text-[12px] text-[#888] hover:text-[#ff4422] hover:bg-[#f0f0f0] transition-all mr-2"
          title="Назад до списку планів"
        >
          ←
        </button>

        {/* Left: plan selector + name */}
        <div className="flex items-center gap-2 flex-1 min-w-0" ref={dropdownRef}>
          <div className="relative">
            <button
              onClick={dropdownOpen ? () => setDropdownOpen(false) : openDropdown}
              className="flex items-center gap-1.5 px-2.5 py-[5px] rounded-md bg-[#f0f0f0] hover:bg-[#e8e8e8] transition-all text-[12px] text-[#555] border border-transparent hover:border-[#ddd]"
            >
              <span>Плани</span>
              <svg width="10" height="6" viewBox="0 0 10 6" className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}>
                <path d="M1 1l4 4 4-4" stroke="#999" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
            </button>

            {dropdownOpen && (
              <div className="absolute top-[calc(100%+6px)] left-0 w-[240px] bg-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-[#f0f0f0] z-50 overflow-hidden">
                {!newPlanInput ? (
                  <button
                    onClick={() => setNewPlanInput(true)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-[#fff8f7] text-[12px] text-[#ff4422] font-medium border-b border-[#f5f5f5] transition-colors"
                  >
                    <span className="text-[14px]">+</span> Новий план
                  </button>
                ) : (
                  <div className="px-3 py-2.5 border-b border-[#f5f5f5] flex items-center gap-2">
                    <input
                      autoFocus
                      value={newPlanName}
                      onChange={e => setNewPlanName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleNewPlan(); if (e.key === 'Escape') setNewPlanInput(false) }}
                      placeholder="Назва плану..."
                      className="flex-1 text-[12px] bg-[#f7f7f7] border border-[#e0e0e0] rounded-md px-2 py-1 outline-none focus:border-[#ff4422]"
                    />
                    <button onClick={handleNewPlan} className="text-[11px] text-white bg-[#ff4422] px-2 py-1 rounded-md hover:bg-[#e03010]">OK</button>
                    <button onClick={() => setNewPlanInput(false)} className="text-[11px] text-[#999]">✕</button>
                  </div>
                )}
                {plans.length === 0 ? (
                  <div className="px-3 py-4 text-[11px] text-[#bbb] text-center">Збережених планів немає</div>
                ) : (
                  <div className="max-h-[220px] overflow-y-auto">
                    {plans.map(plan => (
                      <button
                        key={plan.id}
                        onClick={() => handleLoad(plan)}
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[#f7f7f7] transition-colors group"
                      >
                        <div className="flex flex-col items-start min-w-0">
                          <span className="text-[12px] text-[#333] font-medium truncate max-w-[150px]">{plan.name}</span>
                          <span className="text-[10px] text-[#bbb] font-mono">{formatDate(plan.savedAt)}</span>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 14 14" className="opacity-0 group-hover:opacity-100 flex-shrink-0">
                          <path d="M5 7h4M7 5l2 2-2 2" stroke="#ff4422" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {editingName ? (
            <input
              ref={nameRef}
              autoFocus
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={e => { if (e.key === 'Enter') handleNameSubmit(); if (e.key === 'Escape') setEditingName(false) }}
              className="text-[13px] font-medium text-[#1a1a1a] bg-white border border-[#ff4422] rounded-md px-2 py-[3px] outline-none w-[160px]"
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="text-[13px] font-medium text-[#1a1a1a] hover:text-[#ff4422] transition-colors truncate max-w-[200px]"
              title="Клікни щоб змінити назву"
            >
              {currentPlanName}
              {hasUnsaved && <span className="ml-1 text-[#f5c542] text-[10px]">●</span>}
            </button>
          )}
          {/* Undo */}
          <button
            onClick={() => undo()}
            disabled={history.length === 0}
            className="w-7 h-7 rounded-md flex items-center justify-center text-[13px] text-[#888] hover:text-[#ff4422] hover:bg-[#f0f0f0] disabled:opacity-30 disabled:cursor-not-allowed transition-all ml-2"
            title="Скасувати (Ctrl+Z)"
          >
            ↶
          </button>
        </div>

        {/* Center: mode tabs (absolute center) */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <div className="flex bg-[#ebebeb] rounded-lg p-[3px] gap-[2px]">
            <button
              onClick={() => setMode('constructor')}
              className={`px-5 py-[5px] rounded-md text-[12px] font-medium transition-all ${mode === 'constructor'
                  ? 'bg-white text-[#1a1a1a] shadow-sm'
                  : 'text-[#999] hover:text-[#555]'
                }`}
            >
              Конструктор
            </button>
            <button
              onClick={() => setMode('evacuation')}
              className={`px-5 py-[5px] rounded-md text-[12px] font-medium transition-all ${mode === 'evacuation'
                  ? 'bg-[#ff4422] text-white shadow-sm'
                  : 'text-[#999] hover:text-[#555]'
                }`}
            >
              🔥 Евакуація
            </button>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 flex-1 justify-end">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode('simple')}
              className={`px-2.5 py-[4px] rounded-md text-[11px] font-medium transition-all border ${viewMode === 'simple'
                  ? 'bg-white text-[#1a1a1a] border-[#e0e0e0] shadow-sm'
                  : 'text-[#bbb] border-transparent hover:text-[#888]'
                }`}
            >
              Простий
            </button>
            <button
              onClick={() => setViewMode('advanced')}
              className={`px-2.5 py-[4px] rounded-md text-[11px] font-medium transition-all border ${viewMode === 'advanced'
                  ? 'bg-white text-[#1a1a1a] border-[#e0e0e0] shadow-sm'
                  : 'text-[#bbb] border-transparent hover:text-[#888]'
                }`}
            >
              Розширений
            </button>
          </div>

          <div className="text-[10px] text-[#bbb] font-mono hidden lg:block">
            {isSaving ? (
              <span className="text-[#4d9fff] animate-pulse">Збереження...</span>
            ) : lastSavedLabel ? (
              <span>{lastSavedLabel}</span>
            ) : null}
          </div>

          <button
            onClick={() => setAutoSave(!autoSave)}
            title={autoSave ? 'Автозбереження увімкнено' : 'Автозбереження вимкнено'}
            className={`w-7 h-7 rounded-md flex items-center justify-center text-[13px] transition-all ${autoSave ? 'bg-[#f0fdf4] text-[#22c984]' : 'text-[#ccc] hover:text-[#999]'
              }`}
          >
            ⟳
          </button>

          <button
            onClick={() => save()}
            disabled={isSaving || walls.length === 0}
            className="flex items-center gap-1.5 px-3 py-[5px] bg-[#ff4422] text-white text-[12px] font-medium rounded-md hover:bg-[#e03010] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {isSaving ? '...' : '↑ Зберегти'}
          </button>

          <div className="flex items-center gap-1.5 flex-shrink-0" title={
            backendOnline === null ? 'Перевірка...' :
              backendOnline ? 'Бекенд запущено' : 'Бекенд недоступний'
          }>
            <div className={`w-[6px] h-[6px] rounded-full transition-colors ${backendOnline === null ? 'bg-[#f5c542] animate-pulse' :
                backendOnline ? 'bg-[#22c984]' : 'bg-[#ff4422] animate-pulse'
              }`} />
            <span className={`text-[11px] transition-colors ${backendOnline === null ? 'text-[#f5c542]' :
                backendOnline ? 'text-[#bbb]' : 'text-[#ff4422]'
              }`}>
              {backendOnline === null ? '...' : backendOnline ? 'API' : 'offline'}
            </span>
          </div>
        </div>
      </div>

    </div>
  )
}