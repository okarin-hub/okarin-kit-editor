import { PatternType } from '@/types/kit';

export const PATTERN_OPTIONS: { id: PatternType; label: string }[] = [
  { id: 'vertical-stripes', label: 'Garis Vertikal (Stripes)' },
  { id: 'horizontal-stripes', label: 'Garis Horizontal' },
  { id: 'hoops', label: 'Hoops Tebal (Celtic/Sporting)' },
  { id: 'sash', label: 'Sash Diagonal (River Plate/Monaco)' },
  { id: 'pinstripes', label: 'Pinstripes Tipis Elegan' },
  { id: 'chevron', label: 'Chevron V-Chest (Bordeaux/MU)' },
  { id: 'cross', label: 'Palang Dada (Inter/Parma)' },
  { id: 'gradient', label: 'Gradasi Halus (Fade)' },
  { id: 'halves', label: 'Belah Dua (Halves)' },
  { id: 'checkered', label: 'Kotak-Kotak (Checkered)' },
  { id: 'diagonal-stripes', label: 'Garis Diagonal (45°)' },
  { id: 'subtle-waves', label: 'Gelombang Tekstur (PES Knit)' },
  { id: 'polka-dots', label: 'Polkadot (Dots)' },
];

export const PATTERN_LABEL: Record<string, string> = {
  ...Object.fromEntries(PATTERN_OPTIONS.map((p) => [p.id, p.label])),
  'custom-image': 'Gambar dari Pustaka',
};

/** Patterns made of a repeating motif, which can also be shown just once. */
export const REPEATING_PATTERNS: PatternType[] = [
  'vertical-stripes',
  'horizontal-stripes',
  'hoops',
  'pinstripes',
  'diagonal-stripes',
  'checkered',
  'subtle-waves',
  'polka-dots',
  'custom-image',
];

/** Patterns that have a meaningful stripe / band thickness. */
export const THICKNESS_PATTERNS: PatternType[] = [
  'vertical-stripes',
  'horizontal-stripes',
  'hoops',
  'pinstripes',
  'sash',
  'chevron',
  'cross',
  'diagonal-stripes',
  'polka-dots',
];
