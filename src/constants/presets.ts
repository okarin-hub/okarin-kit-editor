import { KitPartConfig, KitPartId } from '../types/kit';

export interface KitPreset {
  id: string;
  name: string;
  description: string;
  previewColor: string;
  parts: Record<Exclude<KitPartId, 'credit'>, KitPartConfig>;
}

export const DEFAULT_CREDIT_CONFIG: KitPartConfig = {
  color: '#b91c1c',
  pattern: 'none',
  patternColor: '#000000',
  patternScale: 10,
  patternOpacity: 1,
  visible: true,
  label: 'OKARIN KIT EDITOR',
  labelColor: '#ffffff',
};

export const DEFAULT_PART_CONFIG: Record<KitPartId, KitPartConfig> = {
  front: {
    color: '#e11d48', // Crimson Red
    pattern: 'vertical-stripes',
    patternColor: '#1e293b',
    patternScale: 30,
    patternOpacity: 0.9,
    visible: true,
  },
  back: {
    color: '#e11d48',
    pattern: 'none',
    patternColor: '#1e293b',
    patternScale: 30,
    patternOpacity: 0.9,
    visible: true,
  },
  leftSleeve: {
    color: '#1e293b',
    pattern: 'none',
    patternColor: '#e11d48',
    patternScale: 20,
    patternOpacity: 0.8,
    visible: true,
  },
  rightSleeve: {
    color: '#1e293b',
    pattern: 'none',
    patternColor: '#e11d48',
    patternScale: 20,
    patternOpacity: 0.8,
    visible: true,
  },
  leftShorts: {
    color: '#0f172a',
    pattern: 'none',
    patternColor: '#e11d48',
    patternScale: 20,
    patternOpacity: 0.8,
    visible: true,
  },
  rightShorts: {
    color: '#0f172a',
    pattern: 'none',
    patternColor: '#e11d48',
    patternScale: 20,
    patternOpacity: 0.8,
    visible: true,
  },
  leftSock: {
    color: '#e11d48',
    pattern: 'horizontal-stripes',
    patternColor: '#ffffff',
    patternScale: 15,
    patternOpacity: 0.8,
    visible: true,
  },
  rightSock: {
    color: '#e11d48',
    pattern: 'horizontal-stripes',
    patternColor: '#ffffff',
    patternScale: 15,
    patternOpacity: 0.8,
    visible: true,
  },
  collar: {
    color: '#ffffff',
    pattern: 'none',
    patternColor: '#000000',
    patternScale: 10,
    patternOpacity: 1,
    visible: true,
  },
  armband: {
    color: '#eab308', // Yellow
    pattern: 'none',
    patternColor: '#000000',
    patternScale: 10,
    patternOpacity: 1,
    visible: true,
  },
  credit: DEFAULT_CREDIT_CONFIG,
};

export const COLOR_PALETTES = [
  '#e11d48', // Crimson Red
  '#2563eb', // Royal Blue
  '#0f172a', // Midnight Navy
  '#16a34a', // Emerald Green
  '#eab308', // Gold / Yellow
  '#f97316', // Vibrant Orange
  '#9333ea', // Royal Purple
  '#ffffff', // Clean White
  '#1c1c1c', // Stealth Black
  '#64748b', // Slate Gray
  '#06b6d4', // Cyan
  '#84cc16', // Neon Lime
];

export const PRESET_KITS: KitPreset[] = [
  {
    id: 'stealth-black',
    name: 'Stealth Black (Sample Kit)',
    description: 'Kit hitam polos dengan tekstur gelombang halus.',
    previewColor: '#1c1c1c',
    parts: {
      front: { color: '#1c1c1c', pattern: 'subtle-waves', patternColor: '#282828', patternScale: 20, patternOpacity: 0.6, visible: true },
      back: { color: '#1c1c1c', pattern: 'subtle-waves', patternColor: '#282828', patternScale: 20, patternOpacity: 0.6, visible: true },
      leftSleeve: { color: '#1c1c1c', pattern: 'subtle-waves', patternColor: '#282828', patternScale: 20, patternOpacity: 0.6, visible: true },
      rightSleeve: { color: '#1c1c1c', pattern: 'subtle-waves', patternColor: '#282828', patternScale: 20, patternOpacity: 0.6, visible: true },
      leftShorts: { color: '#1c1c1c', pattern: 'none', patternColor: '#333333', patternScale: 20, patternOpacity: 0.5, visible: true },
      rightShorts: { color: '#1c1c1c', pattern: 'none', patternColor: '#333333', patternScale: 20, patternOpacity: 0.5, visible: true },
      leftSock: { color: '#1c1c1c', pattern: 'none', patternColor: '#333333', patternScale: 20, patternOpacity: 0.5, visible: true },
      rightSock: { color: '#1c1c1c', pattern: 'none', patternColor: '#333333', patternScale: 20, patternOpacity: 0.5, visible: true },
      collar: { color: '#555555', pattern: 'none', patternColor: '#000000', patternScale: 10, patternOpacity: 1, visible: true },
      armband: { color: '#4d7c0f', pattern: 'none', patternColor: '#000000', patternScale: 10, patternOpacity: 1, visible: true },
    },
  },
  {
    id: 'classic-red',
    name: 'Crimson Pride',
    description: 'Jersey merah bergaris dengan celana gelap dan aksen putih.',
    previewColor: '#e11d48',
    parts: DEFAULT_PART_CONFIG,
  },
  {
    id: 'royal-azure',
    name: 'Royal Azure',
    description: 'Kombinasi biru laut elegan dengan lengan dan kerah emas.',
    previewColor: '#2563eb',
    parts: {
      front: { color: '#1d4ed8', pattern: 'vertical-stripes', patternColor: '#1e3a8a', patternScale: 24, patternOpacity: 0.8, visible: true },
      back: { color: '#1d4ed8', pattern: 'none', patternColor: '#1e3a8a', patternScale: 24, patternOpacity: 0.8, visible: true },
      leftSleeve: { color: '#1e3a8a', pattern: 'none', patternColor: '#eab308', patternScale: 15, patternOpacity: 0.7, visible: true },
      rightSleeve: { color: '#1e3a8a', pattern: 'none', patternColor: '#eab308', patternScale: 15, patternOpacity: 0.7, visible: true },
      leftShorts: { color: '#ffffff', pattern: 'none', patternColor: '#1d4ed8', patternScale: 15, patternOpacity: 0.5, visible: true },
      rightShorts: { color: '#ffffff', pattern: 'none', patternColor: '#1d4ed8', patternScale: 15, patternOpacity: 0.5, visible: true },
      leftSock: { color: '#1d4ed8', pattern: 'horizontal-stripes', patternColor: '#eab308', patternScale: 14, patternOpacity: 0.9, visible: true },
      rightSock: { color: '#1d4ed8', pattern: 'horizontal-stripes', patternColor: '#eab308', patternScale: 14, patternOpacity: 0.9, visible: true },
      collar: { color: '#eab308', pattern: 'none', patternColor: '#ffffff', patternScale: 10, patternOpacity: 1, visible: true },
      armband: { color: '#facc15', pattern: 'none', patternColor: '#000000', patternScale: 10, patternOpacity: 1, visible: true },
    },
  },
  {
    id: 'pure-white',
    name: 'Blanco Classic',
    description: 'Gaya serba putih bersih dengan aksen garis emas/hitam minimalis.',
    previewColor: '#f8fafc',
    parts: {
      front: { color: '#f8fafc', pattern: 'none', patternColor: '#e2e8f0', patternScale: 20, patternOpacity: 0.5, visible: true },
      back: { color: '#f8fafc', pattern: 'none', patternColor: '#e2e8f0', patternScale: 20, patternOpacity: 0.5, visible: true },
      leftSleeve: { color: '#f8fafc', pattern: 'none', patternColor: '#e2e8f0', patternScale: 20, patternOpacity: 0.5, visible: true },
      rightSleeve: { color: '#f8fafc', pattern: 'none', patternColor: '#e2e8f0', patternScale: 20, patternOpacity: 0.5, visible: true },
      leftShorts: { color: '#f8fafc', pattern: 'none', patternColor: '#e2e8f0', patternScale: 20, patternOpacity: 0.5, visible: true },
      rightShorts: { color: '#f8fafc', pattern: 'none', patternColor: '#e2e8f0', patternScale: 20, patternOpacity: 0.5, visible: true },
      leftSock: { color: '#f8fafc', pattern: 'horizontal-stripes', patternColor: '#d97706', patternScale: 12, patternOpacity: 0.9, visible: true },
      rightSock: { color: '#f8fafc', pattern: 'horizontal-stripes', patternColor: '#d97706', patternScale: 12, patternOpacity: 0.9, visible: true },
      collar: { color: '#d97706', pattern: 'none', patternColor: '#000000', patternScale: 10, patternOpacity: 1, visible: true },
      armband: { color: '#d97706', pattern: 'none', patternColor: '#000000', patternScale: 10, patternOpacity: 1, visible: true },
    },
  },
];
