// EVENT DATA — both lists confirmed.
//
// INGREDIENTS is ordered by point value, highest first.
// DEPARTMENTS is the confirmed list, exactly as supplied.
// Edit ONLY this file; no schema or API change is needed. To reload after
// editing, stop the server, delete backend/data/hotpot.db*, and restart.
//
// Rules the data must respect:
//   - point_value must be a positive integer (no deductions — PRD 4.2).
//   - Values are meant to vary by ingredient, not be a flat rate.
//   - sprite picks the artwork in frontend/sprites.js. An unknown or null
//     sprite falls back to a generic ingredient, so it still renders.

export const INGREDIENTS = [
  { name: 'Crab',         point_value: 50, sprite: 'crab' },
  { name: 'Shabu Beef',   point_value: 40, sprite: 'shabu-beef' },
  { name: 'Pork Ribs',    point_value: 30, sprite: 'pork-ribs' },
  { name: 'Rice',         point_value: 25, sprite: 'rice' },
  { name: 'Cabbage',      point_value: 20, sprite: 'cabbage' },
  { name: 'Corn',         point_value: 20, sprite: 'corn' },
  { name: 'Broccoli',     point_value: 20, sprite: 'broccoli' },
  { name: 'Potato',       point_value: 15, sprite: 'potato' },
  { name: 'Mushroom',     point_value: 15, sprite: 'mushroom' },
  { name: 'Carrot',       point_value: 15, sprite: 'carrot' },
  { name: 'Tomato',       point_value: 15, sprite: 'tomato' },
  { name: 'Capsicum',     point_value: 10, sprite: 'capsicum' },
  { name: 'Red Pepper',   point_value: 10, sprite: 'red-pepper' },
  { name: 'Eggplant',     point_value: 10, sprite: 'eggplant' },
  { name: 'Green Chilli', point_value: 10, sprite: 'green-chilli' },
  { name: 'Peas',         point_value: 10, sprite: 'peas' },
];

export const DEPARTMENTS = [
  'BP',
  'CHROO',
  'Corp Comms',
  'Cumulus',
  'HI',
  'HRP',
  'HRPS',
  'LDS',
  'PCG',
  'PST',
  'ServiceSG',
  'SPR',
  'WD',
];

// Visual only — never affects scoring (PRD 3, 4.5).
export const SOUP_BASES = [
  { id: 'tomato', name: 'Tomato', color: '#E8547A' },
  { id: 'mala',   name: 'Mala',   color: '#D4442A' },
  { id: 'herbal', name: 'Herbal', color: '#4A9B4E' },
  { id: 'laksa',  name: 'Laksa',  color: '#F5821F' },
];
