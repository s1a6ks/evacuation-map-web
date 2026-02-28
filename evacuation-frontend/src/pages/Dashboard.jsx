import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getLsPlans } from '../hooks/useSaveLoad'

// ── SVG icons ────────────────────────────────────────────────
function IconRecent() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M7.5 4.5v3l2 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}
function IconAll() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x="2" y="2" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="8.5" y="2" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="2" y="8.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="8.5" y="8.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  )
}
function IconTrash() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M3 4.5h9M5.5 4.5V3.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v1M6 4.5v6M9 4.5v6M3.5 4.5l.5 7a.5.5 0 00.5.5h5a.5.5 0 00.5-.5l.5-7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}
function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  )
}
function IconSearch() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}
function IconGrid() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  )
}
function IconList() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 3.5h10M2 7h10M2 10.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}
function IconChevron() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M3 4l2 2 2-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconFloorPlan() {
  return (
    <svg width="36" height="28" viewBox="0 0 36 28" fill="none">
      <rect x="2" y="2" width="32" height="24" rx="1" stroke="#d0d0d0" strokeWidth="1.5"/>
      <path d="M13 2v24" stroke="#d0d0d0" strokeWidth="1.5"/>
      <path d="M13 14h21" stroke="#d0d0d0" strokeWidth="1.5"/>
      <path d="M2 10h11" stroke="#d0d0d0" strokeWidth="1.5"/>
    </svg>
  )
}

// Mini SVG preview of a plan
function PlanPreview({ raw }) {
  if (!raw?.walls?.length) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <IconFloorPlan />
      </div>
    )
  }
  const walls = raw.walls
  const allX = walls.flatMap(w => [w.x1, w.x2])
  const allY = walls.flatMap(w => [w.y1, w.y2])
  const minX = Math.min(...allX), maxX = Math.max(...allX)
  const minY = Math.min(...allY), maxY = Math.max(...allY)
  const W = maxX - minX || 1, H = maxY - minY || 1
  const pad = 10
  const vw = 100, vh = 64

  function nx(x) { return pad + ((x - minX) / W) * (vw - pad * 2) }
  function ny(y) { return pad + ((y - minY) / H) * (vh - pad * 2) }

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${vw} ${vh}`} preserveAspectRatio="xMidYMid meet">
      {walls.map((w, i) => (
        <line key={i} x1={nx(w.x1)} y1={ny(w.y1)} x2={nx(w.x2)} y2={ny(w.y2)}
          stroke="#2c2c2c" strokeWidth="1.4" strokeLinecap="round"/>
      ))}
      {raw.exits?.map((e, i) => (
        <g key={i}>
          <circle cx={nx(e.x)} cy={ny(e.y)} r="2.5" fill="#2a6b45"/>
          <circle cx={nx(e.x)} cy={ny(e.y)} r="1.2" fill="#fff"/>
        </g>
      ))}
      {raw.doors?.map((d, i) => (
        <circle key={i} cx={nx(d.x)} cy={ny(d.y)} r="1.3" fill="#7a7a7a"/>
      ))}
    </svg>
  )
}

function formatDate(iso) {
  const d = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60) return 'щойно'
  if (diff < 3600) return `${Math.floor(diff / 60)} хв тому`
  if (diff < 86400) return `${Math.floor(diff / 3600)} год тому`
  if (diff < 604800) return `${Math.floor(diff / 86400)} дн тому`
  return d.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short' })
}

function PlanCard({ plan, onOpen, onDelete, onRestore, onDeleteForever, view, isTrash }) {
  const [hovered, setHovered] = useState(false)

  if (view === 'list') {
    return (
      <div
        onClick={() => !isTrash && onOpen(plan)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="flex items-center gap-4 px-3 py-2.5 rounded-lg transition-all"
        style={{
          background: hovered ? '#f4f4f4' : 'transparent',
          cursor: isTrash ? 'default' : 'pointer',
          opacity: isTrash ? 0.7 : 1,
        }}
      >
        <div className="w-12 h-8 rounded bg-[#f0f0f0] flex-shrink-0 overflow-hidden">
          <PlanPreview raw={plan.raw} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-[#1a1a1a] truncate">{plan.name}</div>
        </div>
        <div className="text-[11px] text-[#aaa] flex-shrink-0 w-28 text-right">
          {formatDate(plan.savedAt)}
        </div>
        <div className="flex gap-3 text-[11px] text-[#bbb] flex-shrink-0 w-32 justify-end font-mono">
          {plan.raw && <>
            <span>{plan.raw.walls?.length || 0} ст.</span>
            <span className="text-[#2a6b45]">{plan.raw.exits?.length || 0} вих.</span>
          </>}
        </div>
        <div className="flex items-center gap-1 ml-1" style={{ opacity: hovered ? 1 : 0 }}>
          {isTrash ? (
            <>
              <button onClick={e => { e.stopPropagation(); onRestore(plan.id) }}
                className="text-[11px] px-2 py-[3px] rounded-md bg-[#f0fdf4] text-[#22c984] hover:bg-[#dcfce7] transition-colors">
                Відновити
              </button>
              <button onClick={e => { e.stopPropagation(); onDeleteForever(plan.id) }}
                className="text-[#ccc] hover:text-[#ff4422] transition-colors px-1">
                <IconTrash />
              </button>
            </>
          ) : (
            <button onClick={e => { e.stopPropagation(); onDelete(plan.id) }}
              className="text-[#ccc] hover:text-[#888] transition-colors">
              <IconTrash />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={() => !isTrash && onOpen(plan)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-xl border transition-all overflow-hidden"
      style={{
        borderColor: hovered ? '#b0b0b0' : '#e8e8e8',
        background: '#fff',
        boxShadow: hovered ? '0 4px 16px rgba(0,0,0,0.09)' : '0 1px 3px rgba(0,0,0,0.04)',
        transform: (!isTrash && hovered) ? 'translateY(-1px)' : 'none',
        cursor: isTrash ? 'default' : 'pointer',
        opacity: isTrash ? 0.7 : 1,
      }}
    >
      <div className="relative overflow-hidden" style={{ height: '130px', background: '#f7f7f7' }}>
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <PlanPreview raw={plan.raw} />
        </div>
        {hovered && (
          <div className="absolute inset-0 flex items-center justify-center gap-2"
            style={{ background: 'rgba(255,255,255,0.93)' }}>
            {isTrash ? (
              <>
                <button
                  onClick={e => { e.stopPropagation(); onRestore(plan.id) }}
                  className="px-4 py-1.5 bg-[#22c984] text-white text-[12px] font-medium rounded-lg hover:bg-[#16a57a] transition-colors"
                >
                  Відновити
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onDeleteForever(plan.id) }}
                  className="px-3 py-1.5 bg-[#fff0ee] text-[#ff4422] text-[12px] rounded-lg hover:bg-[#ffe4e0] transition-colors"
                >
                  <IconTrash />
                </button>
              </>
            ) : (
              <>
                <button className="px-4 py-1.5 bg-[#1a1a1a] text-white text-[12px] font-medium rounded-lg hover:bg-[#333] transition-colors">
                  Відкрити
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onDelete(plan.id) }}
                  className="px-3 py-1.5 bg-[#f0f0f0] text-[#888] text-[12px] rounded-lg hover:bg-[#e8e8e8] transition-colors"
                >
                  <IconTrash />
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <div className="px-3 py-2.5 border-t border-[#f0f0f0]">
        <div className="text-[13px] font-semibold text-[#1a1a1a] truncate">{plan.name}</div>
        <div className="text-[11px] text-[#aaa] mt-0.5">{formatDate(plan.savedAt)}</div>
        {plan.raw && (
          <div className="flex gap-2 mt-1.5 text-[10px] font-mono text-[#bbb]">
            <span>{plan.raw.walls?.length || 0} стін</span>
            <span>·</span>
            <span className="text-[#2a6b45]">{plan.raw.exits?.length || 0} виходів</span>
            {plan.raw.stairs?.length > 0 && <>
              <span>·</span>
              <span className="text-[#888]">{plan.raw.stairs.length} сходів</span>
            </>}
          </div>
        )}
      </div>
    </div>
  )
}

function NavItem({ icon, label, active, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all"
      style={{
        background: active ? '#efefef' : hovered ? '#f4f4f4' : 'transparent',
        color: active ? '#1a1a1a' : '#666',
      }}
    >
      <span className="flex-shrink-0" style={{ color: active ? '#1a1a1a' : '#999' }}>{icon}</span>
      <span className="text-[12.5px] font-medium">{label}</span>
    </button>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const location  = useLocation()
  const [plans, setPlans]           = useState(() => getLsPlans())
  const [navSection, setNavSection] = useState('recent') // 'recent' | 'all' | 'trash'
  const [search, setSearch]         = useState('')
  const [view, setView]             = useState('grid')
  const [sort, setSort]             = useState('date')
  const [sortOpen, setSortOpen]     = useState(false)
  const [showModal, setShowModal]   = useState(false)
  const [newName, setNewName]       = useState('')
  const inputRef                    = useRef(null)

  useEffect(() => {
    const fresh = getLsPlans()
    setPlans(prev => {
      const prevStr = JSON.stringify(prev)
      const freshStr = JSON.stringify(fresh)
      return prevStr === freshStr ? prev : fresh
    })
  }, [location.key])

  useEffect(() => {
    function onFocus() { setPlans(getLsPlans()) }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  useEffect(() => {
    if (showModal) setTimeout(() => inputRef.current?.focus(), 60)
  }, [showModal])

  function savePlans(updated) {
    localStorage.setItem('evacroute_plans', JSON.stringify(updated))
    setPlans(updated)
  }

  // М'яке видалення — переміщення в кошик
  function handleDelete(planId) {
    if (!confirm('Перемістити в кошик?')) return
    savePlans(plans.map(p => p.id === planId ? { ...p, deletedAt: new Date().toISOString() } : p))
  }

  // Відновити з кошика
  function handleRestore(planId) {
    savePlans(plans.map(p => {
      if (p.id !== planId) return p
      const { deletedAt, ...rest } = p
      return rest
    }))
  }

  // Видалити назавжди
  function handleDeleteForever(planId) {
    if (!confirm('Видалити назавжди? Це незворотньо.')) return
    savePlans(plans.filter(p => p.id !== planId))
  }

  function handleCreate() {
    setShowModal(false)
    navigate('/plan/new', { state: { name: newName.trim() || 'Новий план' } })
    setNewName('')
  }

  const activePlans = plans.filter(p => !p.deletedAt)
  const trashedPlans = plans.filter(p => p.deletedAt)
  const trashCount = trashedPlans.length

  const sortedActive = activePlans
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sort === 'date'
      ? new Date(b.savedAt) - new Date(a.savedAt)
      : a.name.localeCompare(b.name, 'uk'))

  const filtered = navSection === 'trash'
    ? trashedPlans.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : navSection === 'recent'
      ? sortedActive.slice(0, 7)
      : sortedActive

  const isTrashView = navSection === 'trash'
  const sortLabels = { date: 'За датою', name: 'За назвою' }

  const sectionLabel = {
    recent: `Останні · ${filtered.length}`,
    all:    `Всі плани · ${filtered.length}`,
    trash:  `Кошик · ${filtered.length}`,
  }[navSection]

  return (
    <div className="flex h-screen bg-white" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>

      {/* ── Sidebar ── */}
      <aside className="flex-shrink-0 flex flex-col border-r border-[#ebebeb]"
        style={{ width: '210px', background: '#f9f9f9' }}>

        <div className="px-5 py-[18px] border-b border-[#ebebeb] flex items-center gap-2.5">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <rect x="2" y="2" width="18" height="18" rx="3" stroke="#1a1a1a" strokeWidth="1.6"/>
            <path d="M2 9h18M9 9v11" stroke="#1a1a1a" strokeWidth="1.6"/>
          </svg>
          <span className="text-[15px] font-bold text-[#1a1a1a] tracking-tight">EvacRoute</span>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          <NavItem icon={<IconRecent />} label="Останні"
            active={navSection === 'recent'} onClick={() => { setNavSection('recent'); setSearch('') }} />
          <NavItem icon={<IconAll />} label="Всі плани"
            active={navSection === 'all'} onClick={() => { setNavSection('all'); setSearch('') }} />
          <NavItem
            icon={<IconTrash />}
            label={trashCount > 0 ? `Кошик (${trashCount})` : 'Кошик'}
            active={navSection === 'trash'}
            onClick={() => { setNavSection('trash'); setSearch('') }}
          />
        </nav>

        <div className="px-4 py-3 border-t border-[#ebebeb]">
          <div className="text-[10px] text-[#bbb] font-mono">v1.0 · диплом 2026</div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col overflow-hidden bg-white">

        {/* Topbar */}
        <div className="h-[52px] border-b border-[#ebebeb] px-6 flex items-center gap-3 flex-shrink-0">
          <div className="relative flex-1 max-w-[280px]">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#bbb]"><IconSearch /></span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Пошук..."
              className="w-full pl-8 pr-3 py-[5px] text-[12.5px] bg-[#f4f4f4] rounded-lg outline-none border border-transparent focus:bg-white focus:border-[#d0d0d0] transition-all"
            />
          </div>

          <div className="flex-1" />

          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => setSortOpen(v => !v)}
              className="flex items-center gap-1.5 px-3 py-[5px] text-[12px] text-[#666] bg-[#f4f4f4] rounded-lg hover:bg-[#ebebeb] transition-colors"
            >
              {sortLabels[sort]}
              <span style={{ transform: sortOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
                <IconChevron />
              </span>
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-[calc(100%+4px)] bg-white rounded-xl shadow-xl border border-[#ebebeb] z-50 overflow-hidden min-w-[130px]">
                {Object.entries(sortLabels).map(([k, v]) => (
                  <button key={k} onClick={() => { setSort(k); setSortOpen(false) }}
                    className={`w-full px-4 py-2.5 text-left text-[12.5px] hover:bg-[#f7f7f7] transition-colors ${sort === k ? 'font-semibold text-[#1a1a1a]' : 'text-[#666]'}`}
                  >{v}</button>
                ))}
              </div>
            )}
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-0.5 bg-[#f4f4f4] rounded-lg p-0.5">
            {[['grid', <IconGrid />], ['list', <IconList />]].map(([id, icon]) => (
              <button key={id} onClick={() => setView(id)}
                className="w-7 h-7 rounded-md flex items-center justify-center transition-all"
                style={{
                  background: view === id ? '#fff' : 'transparent',
                  color: view === id ? '#1a1a1a' : '#bbb',
                  boxShadow: view === id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >{icon}</button>
            ))}
          </div>

          {/* New */}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-[6px] bg-[#1a1a1a] text-white text-[12.5px] font-semibold rounded-lg hover:bg-[#2d2d2d] transition-colors"
          >
            <IconPlus /> Новий план
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Empty: кошик порожній */}
          {isTrashView && filtered.length === 0 && !search && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <div className="text-[40px] opacity-20">🗑</div>
              <div className="text-[15px] font-semibold text-[#c0c0c0]">Кошик порожній</div>
              <div className="text-[12.5px] text-[#ccc]">Видалені плани з'являться тут</div>
            </div>
          )}

          {/* Empty: немає планів взагалі */}
          {!isTrashView && activePlans.length === 0 && !search && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <svg width="64" height="52" viewBox="0 0 64 52" fill="none" className="opacity-15">
                <rect x="3" y="3" width="58" height="46" rx="3" stroke="#1a1a1a" strokeWidth="2"/>
                <path d="M3 18h58M24 18v32" stroke="#1a1a1a" strokeWidth="2"/>
              </svg>
              <div className="text-[15px] font-semibold text-[#c0c0c0]">Планів ще немає</div>
              <div className="text-[12.5px] text-[#ccc]">Створіть перший евакуаційний план</div>
              <button
                onClick={() => setShowModal(true)}
                className="mt-2 flex items-center gap-1.5 px-5 py-2 bg-[#1a1a1a] text-white text-[12.5px] font-medium rounded-lg hover:bg-[#333] transition-colors"
              >
                <IconPlus /> Створити
              </button>
            </div>
          )}

          {/* Empty: пошук не дав результатів */}
          {search && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <div className="text-[13px] text-[#bbb]">Нічого за «{search}»</div>
              <button onClick={() => setSearch('')} className="text-[12px] text-[#666] underline">скинути</button>
            </div>
          )}

          {filtered.length > 0 && (
            <>
              <div className="text-[11px] text-[#bbb] font-mono mb-4 uppercase tracking-wider">
                {search ? `Результати · ${filtered.length}` : sectionLabel}
              </div>

              {view === 'grid' ? (
                <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
                  {!isTrashView && (
                    <button
                      onClick={() => setShowModal(true)}
                      className="rounded-xl border-2 border-dashed border-[#e0e0e0] hover:border-[#b0b0b0] transition-all flex flex-col items-center justify-center gap-2 text-[#ccc] hover:text-[#888]"
                      style={{ height: '200px' }}
                    >
                      <div className="w-9 h-9 rounded-xl border-[1.5px] border-current flex items-center justify-center">
                        <IconPlus />
                      </div>
                      <span className="text-[12px] font-medium">Новий план</span>
                    </button>
                  )}
                  {filtered.map(p => (
                    <PlanCard key={p.id} plan={p} view="grid"
                      onOpen={pl => navigate(`/plan/${pl.id}`)}
                      onDelete={handleDelete}
                      onRestore={handleRestore}
                      onDeleteForever={handleDeleteForever}
                      isTrash={isTrashView} />
                  ))}
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-4 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#bbb] border-b border-[#f0f0f0] mb-1">
                    <div className="w-12 flex-shrink-0" />
                    <div className="flex-1">Назва</div>
                    <div className="w-28 text-right">Змінено</div>
                    <div className="w-32 text-right">Елементи</div>
                    <div className="w-6" />
                  </div>
                  {filtered.map(p => (
                    <PlanCard key={p.id} plan={p} view="list"
                      onOpen={pl => navigate(`/plan/${pl.id}`)}
                      onDelete={handleDelete}
                      onRestore={handleRestore}
                      onDeleteForever={handleDeleteForever}
                      isTrash={isTrashView} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.3)' }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[340px] p-6">
            <div className="text-[15px] font-bold text-[#1a1a1a] mb-1">Новий план</div>
            <div className="text-[12px] text-[#aaa] mb-4">Введіть назву евакуаційного плану</div>
            <input
              ref={inputRef}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowModal(false) }}
              placeholder="Наприклад: Офіс 3 поверх..."
              className="w-full text-[13px] bg-[#f7f7f7] border border-[#e8e8e8] rounded-xl px-4 py-3 outline-none focus:border-[#b0b0b0] focus:bg-white transition-all mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl text-[12.5px] text-[#888] bg-[#f4f4f4] hover:bg-[#ebebeb] transition-colors font-medium">
                Скасувати
              </button>
              <button onClick={handleCreate}
                className="flex-1 py-2.5 rounded-xl text-[12.5px] text-white font-semibold bg-[#1a1a1a] hover:bg-[#333] transition-colors">
                Створити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}