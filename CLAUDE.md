# EvacRoute — CLAUDE.md

## Проект
Дипломна робота: «Розробка вебсистеми пошуку евакуаційних маршрутів на основі графових моделей будівлі»
Дедлайн: червень 2026

## Стек
- **Frontend:** React 18 + Vite + Zustand + Tailwind CSS + Canvas API + jsPDF
- **Backend:** ASP.NET Core 8 + SQLite + EF Core
- **Routing:** React Router DOM

## Запуск

### Backend
```bash
cd EvacuationSystem.Api/EvacuationSystem.Api
dotnet run
# API: https://localhost:7xxx або http://localhost:5xxx
```

### Frontend
```bash
cd evacuation-frontend
npm install
npm run dev
# http://localhost:5173
```

## Структура

```
C:/evacuation-map-web/
├── EvacuationSystem.Api/EvacuationSystem.Api/
│   └── Program.cs              # Всі endpoints в одному файлі
└── evacuation-frontend/src/
    ├── pages/
    │   ├── Dashboard.jsx        # Список планів (Figma-стиль)
    │   └── Editor.jsx           # Редактор планів
    ├── components/
    │   ├── Canvas/
    │   │   ├── FloorCanvas.jsx  # tabIndex={0}, zoom/pan, floor tabs
    │   │   └── hooks/
    │   │       ├── useDrawing.js
    │   │       ├── useRender.js
    │   │       ├── useFloodFill.js
    │   │       ├── useGraphGen.js
    │   │       └── useEvacuation.js
    │   ├── Layout/
    │   │   ├── TopBar.jsx
    │   │   └── StatusBar.jsx
    │   ├── Panel/
    │   │   ├── RightPanel.jsx
    │   │   └── EvacuationPanel.jsx
    │   └── Toolbar/
    │       └── Toolbar.jsx      # 7 інструментів + SVG іконки
    ├── hooks/
    │   ├── useSaveLoad.js       # localStorage-first, потім backend sync
    │   └── useKeyboardShortcuts.js
    ├── store/useStore.js        # Zustand
    ├── utils/
    │   ├── pathfinding.js       # A* + Dijkstra (на фронті)
    │   ├── evacAnalysis.js      # ДБН В.1.1-7
    │   └── pdfExport.js        # jsPDF
    ├── services/api.js
    └── data/templates.js
```

## Архітектурні рішення

- **Routing на фронті**: A* і Dijkstra в `utils/pathfinding.js` — граф будується з canvas-даних які є тільки на клієнті
- **Backend = репозиторій**: зберігає графові моделі (nodes/edges/rooms), не рахує маршрути
- **Збереження**: localStorage завжди перший, потім async sync з backend
- **ID стратегія**: локальні плани мають `local_{timestamp}_{random}`, backend повертає числові ID

## Маршрути React Router

```
/                    → Dashboard
/plan/new            → Editor (name з location.state.name)
/plan/:planId        → Editor (String(p.id) === String(planId))
/plan/template/:id   → Editor (office/school/mall)
```

## Keyboard shortcuts

```
Ctrl+Z      — Undo (завжди, незалежно від mode)
1/W/Ц       — Стіна
2/D/В       — Двері
3/E/У       — Вихід
4/S/І       — Сходи
5/X/Ч       — Стерти
6/F/А       — Вогнегасник
V/М         — Вибір
Escape      — Скасувати малювання
Delete      — Перемкнути на Erase
Ctrl+/-/0   — Zoom
```

## Store (Zustand) — ключові поля

```
walls, doors, exits, stairs, extinguishers
graphNodes, graphEdges, detectedRooms
floors, currentFloorId, floorDataMap, stairLinks
mode ('constructor'|'evacuation'), tool, scale, offset
history (undo stack)
```

## Що ще потрібно зробити

Основні баги виправлено. Відкритих задач немає.
