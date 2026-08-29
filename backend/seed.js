// PLACEHOLDER DATA — see PRD Section 9 (Pending Inputs).
//
// When the confirmed ingredient list, point values, and department list arrive,
// edit ONLY this file. No schema or API change is needed. To reload after
// editing, stop the server, delete backend/data/hotpot.db*, and restart.
//
// Rules the data must respect:
//   - point_value must be a positive integer (no deductions — PRD 4.2).
//   - Values are meant to vary by ingredient, not be a flat rate.
//   - sprite picks the artwork in frontend/sprites.js. An unknown or null
//     sprite falls back to a generic ingredient, so it still renders.

export const INGREDIENTS = [
  { name: 'Broccoli',    point_value: 10, sprite: 'broccoli' },
  { name: 'Mushroom',    point_value: 15, sprite: 'mushroom' },
  { name: 'Carrot',      point_value: 10, sprite: 'carrot' },
  { name: 'Shrimp ball', point_value: 20, sprite: 'shrimp-ball' },
  { name: 'Fish tofu',   point_value: 10, sprite: 'fish-tofu' },
];

export const DEPARTMENTS = [
  'Department A',
  'Department B',
  'Department C',
];

// Visual only — never affects scoring (PRD 3, 4.5).
export const SOUP_BASES = [
  { id: 'tomato', name: 'Tomato', color: '#E8547A' },
  { id: 'mala',   name: 'Mala',   color: '#D4442A' },
  { id: 'herbal', name: 'Herbal', color: '#4A9B4E' },
  { id: 'laksa',  name: 'Laksa',  color: '#F5821F' },
];
