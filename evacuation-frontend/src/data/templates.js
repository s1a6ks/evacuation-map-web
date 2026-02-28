// Готові шаблони планів

const TEMPLATES = {
  office: {
    name: 'Офіс (1 поверх)',
    description: '6 кімнат, 2 виходи',
    data: {
      walls: [
        // Зовнішній периметр
        { x1: 60, y1: 60, x2: 460, y2: 60 },
        { x1: 460, y1: 60, x2: 460, y2: 360 },
        { x1: 460, y1: 360, x2: 60, y2: 360 },
        { x1: 60, y1: 360, x2: 60, y2: 60 },
        // Внутрішні стіни
        { x1: 260, y1: 60, x2: 260, y2: 360 },
        { x1: 60, y1: 160, x2: 260, y2: 160 },
        { x1: 60, y1: 260, x2: 260, y2: 260 },
        { x1: 260, y1: 160, x2: 460, y2: 160 },
        { x1: 260, y1: 260, x2: 460, y2: 260 },
      ],
      doors: [
        { x: 160, y: 160, horiz: true },
        { x: 260, y: 110, horiz: false },
        { x: 160, y: 260, horiz: true },
        { x: 260, y: 210, horiz: false },
        { x: 360, y: 160, horiz: true },
        { x: 360, y: 260, horiz: true },
      ],
      exits: [
        { x: 60, y: 310, horiz: false },
        { x: 460, y: 310, horiz: false },
      ],
      stairs: [],
    },
  },

  school: {
    name: 'Школа (2 поверхи)',
    description: '12 класів, сходи',
    data: {
      walls: [
        // Зовнішній периметр
        { x1: 40, y1: 40, x2: 480, y2: 40 },
        { x1: 480, y1: 40, x2: 480, y2: 380 },
        { x1: 480, y1: 380, x2: 40, y2: 380 },
        { x1: 40, y1: 380, x2: 40, y2: 40 },
        // Коридор по центру
        { x1: 40, y1: 180, x2: 480, y2: 180 },
        { x1: 40, y1: 240, x2: 480, y2: 240 },
        // Поділ на класи
        { x1: 160, y1: 40, x2: 160, y2: 180 },
        { x1: 280, y1: 40, x2: 280, y2: 180 },
        { x1: 400, y1: 40, x2: 400, y2: 180 },
        { x1: 160, y1: 240, x2: 160, y2: 380 },
        { x1: 280, y1: 240, x2: 280, y2: 380 },
        { x1: 400, y1: 240, x2: 400, y2: 380 },
      ],
      doors: [
        { x: 100, y: 180, horiz: true },
        { x: 220, y: 180, horiz: true },
        { x: 340, y: 180, horiz: true },
        { x: 440, y: 180, horiz: true },
        { x: 100, y: 240, horiz: true },
        { x: 220, y: 240, horiz: true },
        { x: 340, y: 240, horiz: true },
        { x: 440, y: 240, horiz: true },
      ],
      exits: [
        { x: 40, y: 210, horiz: false },
        { x: 480, y: 210, horiz: false },
      ],
      stairs: [
        { x: 260, y: 210 },
      ],
    },
  },

  mall: {
    name: 'ТЦ (3 поверхи)',
    description: 'Торговий центр',
    data: {
      walls: [
        // L-подібна будівля
        { x1: 40, y1: 40, x2: 400, y2: 40 },
        { x1: 400, y1: 40, x2: 400, y2: 200 },
        { x1: 400, y1: 200, x2: 480, y2: 200 },
        { x1: 480, y1: 200, x2: 480, y2: 360 },
        { x1: 480, y1: 360, x2: 40, y2: 360 },
        { x1: 40, y1: 360, x2: 40, y2: 40 },
        // Внутрішні
        { x1: 220, y1: 40, x2: 220, y2: 200 },
        { x1: 40, y1: 200, x2: 400, y2: 200 },
        { x1: 220, y1: 200, x2: 220, y2: 360 },
      ],
      doors: [
        { x: 130, y: 200, horiz: true },
        { x: 310, y: 200, horiz: true },
        { x: 220, y: 280, horiz: false },
      ],
      exits: [
        { x: 40, y: 310, horiz: false },
        { x: 480, y: 280, horiz: false },
      ],
      stairs: [
        { x: 350, y: 280 },
      ],
    },
  },
}

export function getTemplate(id) {
  return TEMPLATES[id] || null
}

export function getAllTemplates() {
  return Object.entries(TEMPLATES).map(([id, data]) => ({ id, ...data }))
}