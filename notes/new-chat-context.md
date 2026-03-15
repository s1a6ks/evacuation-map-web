# EvacRoute — Контекст для нового чату

## Тема диплому
«Розробка вебсистеми пошуку евакуаційних маршрутів на основі графових моделей будівлі»  
Керівник: Олена Смалько, к.п.н., доцент кафедри комп'ютерних наук  
Дедлайн: червень 2026

## Стек
- **Frontend:** React 18 + Vite + Zustand + Tailwind CSS + Canvas API + jsPDF
- **Backend:** ASP.NET Core 8 + SQLite
- **Routing:** React Router DOM

## Структура проєкту
```
C:/evacuation-map-web/evacuation-frontend/src/
├── pages/
│   ├── Dashboard.jsx       # Список планів (Figma-стиль: сайдбар + грід карток з SVG прев'ю)
│   └── Editor.jsx          # Редактор планів
├── components/
│   ├── Canvas/
│   │   ├── FloorCanvas.jsx           # tabIndex={0} для фокусу
│   │   └── hooks/
│   │       ├── useDrawing.js         # Малювання + erase + вогнегасники
│   │       ├── useRender.js          # Canvas рендер (Simple/Advanced)
│   │       ├── useFloodFill.js       # Автовиявлення кімнат (flood fill)
│   │       ├── useGraphGen.js        # Генерація графа
│   │       └── useEvacuation.js      # Побудова маршрутів
│   ├── Layout/
│   │   ├── TopBar.jsx
│   │   └── StatusBar.jsx
│   ├── Panel/
│   │   ├── RightPanel.jsx
│   │   └── EvacuationPanel.jsx
│   └── Toolbar/
│       └── Toolbar.jsx               # 7 інструментів + SVG іконки
├── hooks/
│   ├── useSaveLoad.js                # Локально спочатку, потім бекенд
│   └── useKeyboardShortcuts.js       # capture:true, укр.розкладка
├── store/
│   └── useStore.js                   # Zustand: walls/doors/exits/stairs/extinguishers
├── utils/
│   ├── pathfinding.js                # A* + Dijkstra (обидва на фронті)
│   ├── evacAnalysis.js               # Аналіз ДБН В.1.1-7
│   └── pdfExport.js                  # jsPDF (виправлено setTextColor)
├── services/
│   └── api.js
└── data/
    └── templates.js
```

## Що вже зроблено і виправлено

### ✅ Баги виправлені
1. **Dashboard.jsx** — порожній файл → повна Figma-стиль реалізація
2. **RightPanel.jsx** — невалідний JSX в rooms map
3. **Editor.jsx** — `loadTemplate` до оголошення → `useCallback`, підтримка `location.state.name`
4. **useSaveLoad.js** — плани тепер спочатку завжди в localStorage, потім sync з бекендом
5. **useSaveLoad.js** — `preparePayload` не деструктурував `extinguishers` → збереження падало
6. **pdfExport.js** — `setTextColor(150)` → `setTextColor(180, 180, 180)`
7. **useKeyboardShortcuts.js** — `capture: true`, `Ctrl+Z` без обмеження по mode, українська розкладка
8. **FloorCanvas.jsx** — `tabIndex={0}` для фокусу canvas

### ✅ Новий функціонал
- **Вогнегасники** — інструмент `6/F`, SVG іконка, рендер на canvas (червоний балон + "ВВП"), store/localStorage

### ✅ Архітектурне рішення (для захисту)
- A* і Dijkstra на **фронті** — граф будується з canvas-даних які є тільки на клієнті
- Бекенд = репозиторій графових моделей (персистентність)

## ❗ Що залишилось зробити

### 🔴 Критично
- [ ] **PDF всіх поверхів** — `exportPlanToPDF` треба доробити: перебрати поверхи через `switchFloor()` → `render()` → `canvas.toDataURL()` → додати сторінку. Зараз завжди знімає тільки поточний canvas
- [ ] **PDF поточного поверху** — `exportCurrentFloorToPDF` є, перевірити чи викликається правильно з TopBar/RightPanel
- [ ] **Перевірити завантаження планів** — ID matching `local_xxx` vs числові бекенд-ID

### 🟡 Бекенд рефакторинг
- [ ] Видалити `/api/navigation/*` endpoints з ASP.NET
- [ ] Розкласти по папках: Controllers/, Services/, Models/
- [ ] Прибрати navigation-виклики з `api.js` і `useEvacuation.js`

### 🟢 Дрібниці
- [ ] Протестувати Ctrl+Z після виправлень
- [ ] Перевірити PNG експорт

## Ключова логіка

### Збереження
```js
// localStorage: { id, name, savedAt, localOnly, raw: { walls, doors, exits, stairs, extinguishers } }
// Стратегія: спочатку локально (genLocalId), потім sync з бекендом
```

### Keyboard shortcuts
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

### PDF експорт — потребує доопрацювання
```js
// Для експорту всіх поверхів потрібно:
// 1. Зберегти поточний floorId
// 2. Для кожного floor: switchFloor(floor.id) → зачекати render → canvas.toDataURL()
// 3. Зібрати imageData всіх поверхів → jsPDF (кожен поверх = сторінка)
// 4. Повернутись на початковий поверх
// Важливо: render відбувається в useEffect після зміни стану — треба або useRef на imageData,
// або окремий offscreen canvas для кожного поверху
```

### Routing
```
/              → Dashboard
/plan/new      → Editor (name з location.state.name)
/plan/:id      → Editor (String(p.id) === String(planId))
/plan/template/:id → Editor (office/school/mall)
```

### Store основні поля
```
walls, doors, exits, stairs, extinguishers,
graphNodes, graphEdges, detectedRooms,
floors, currentFloorId, stairLinks,
mode ('constructor'|'evacuation'), tool, scale, offset, history
```

## npm
```bash
npm install react-router-dom@^7.1.3 jspdf@^2.5.2
```

## Демо (захист)
Реальний план корпусу університету. Сценарій: малювання → автограф → маршрут → A* vs Dijkstra → багатоповерховий → ДБН → експорт PNG/PDF