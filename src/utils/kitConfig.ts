/**
 * Kitserver (kserv.lua) config.txt: read, edit and write it the way kserv does.
 * The config is kept as its text so comments, order and keys this editor does not know survive a round trip.
 */

export type KitConfigGroup = 'shirt' | 'back' | 'front' | 'shorts' | 'files' | 'colors' | 'badges';

export interface KitConfigField {
  key: string;
  label: string;
  group: KitConfigGroup;
  /** number field range (kserv's own limits) */
  min?: number;
  max?: number;
  /** fixed choices: value -> label */
  options?: [number, string][];
  kind?: 'color' | 'file';
  /** value kserv assumes when the key is missing */
  def?: number;
}

export const KIT_CONFIG_GROUPS: [KitConfigGroup, string][] = [
  ['shirt', 'Baju'],
  ['back', 'Punggung (nama & nomor)'],
  ['front', 'Nomor dada'],
  ['shorts', 'Celana'],
  ['colors', 'Warna kit'],
  ['badges', 'Posisi badge lengan'],
  ['files', 'File tekstur'],
];

// limits copied from the overlay_states table of kserv.lua 1.13
export const KIT_CONFIG_FIELDS: KitConfigField[] = [
  { key: 'ShortSleevesModel', label: 'Model lengan pendek', group: 'shirt', options: [[1, '1 = Normal'], [2, '2 = Kappa'], [3, '3 = Wasit']] },
  { key: 'ShirtModel', label: 'Model baju', group: 'shirt', options: [[144, '144'], [151, '151 = Semi-long'], [160, '160'], [176, '176 = Legacy']] },
  { key: 'Collar', label: 'Kerah', group: 'shirt', min: 1, max: 135 },
  { key: 'TightKit', label: 'Baju ketat', group: 'shirt', options: [[0, 'Off'], [1, 'On']] },
  { key: 'ShirtPattern', label: 'Pola baju', group: 'shirt', min: 0, max: 6 },
  { key: 'WinterCollar', label: 'Kerah musim dingin', group: 'shirt', min: 1, max: 135 },
  { key: 'LongSleevesType', label: 'Lengan panjang', group: 'shirt', options: [[62, '62 = Normal & Undershirt'], [187, '187 = Hanya Undershirt']] },
  { key: 'SleeveLimits', label: 'Batas lengan', group: 'shirt', def: 0, options: [[0, 'None'], [1, 'Hanya panjang'], [2, 'Hanya pendek']] },

  { key: 'Name', label: 'Nama', group: 'back', options: [[0, 'On'], [1, 'Off']] },
  { key: 'NameShape', label: 'Bentuk nama', group: 'back', options: [[0, 'Lurus'], [1, 'Lengkung ringan'], [2, 'Lengkung sedang'], [3, 'Lengkung ekstrem']] },
  { key: 'NameY', label: 'Nama Y', group: 'back', min: 0, max: 39 },
  { key: 'NameSize', label: 'Ukuran nama', group: 'back', min: 0, max: 20 },
  { key: 'NameStretch', label: 'Regangan nama', group: 'back', min: 0, max: 3, def: 0 },
  { key: 'BackNumberY', label: 'Nomor punggung Y', group: 'back', min: 0, max: 29 },
  { key: 'BackNumberSize', label: 'Ukuran nomor punggung', group: 'back', min: 0, max: 28 },
  { key: 'BackNumberSpacing', label: 'Jarak angka punggung', group: 'back', min: 0, max: 15 },
  { key: 'BackNumberType', label: 'Tipe nomor punggung', group: 'back', def: 0, options: [[0, 'Normal'], [1, 'Paksa dua digit']] },

  { key: 'ChestNumberX', label: 'Nomor dada X', group: 'front', min: 0, max: 29 },
  { key: 'ChestNumberY', label: 'Nomor dada Y', group: 'front', min: 0, max: 29 },
  { key: 'ChestNumberSize', label: 'Ukuran nomor dada', group: 'front', min: 0, max: 28 },

  { key: 'ShortsModel', label: 'Model celana', group: 'shorts', min: 0, max: 17 },
  { key: 'ShortsNumberSide', label: 'Sisi nomor celana', group: 'shorts', options: [[0, 'Kiri'], [1, 'Kanan']] },
  { key: 'ShortsNumberX', label: 'Nomor celana X', group: 'shorts', min: 0, max: 31 },
  { key: 'ShortsNumberY', label: 'Nomor celana Y', group: 'shorts', min: 0, max: 31 },
  { key: 'ShortsNumberSize', label: 'Ukuran nomor celana', group: 'shorts', min: 0, max: 28 },

  { key: 'KitFile', label: 'Tekstur kit', group: 'files', kind: 'file' },
  { key: 'BackNumbersFile', label: 'Font nomor punggung', group: 'files', kind: 'file' },
  { key: 'ChestNumbersFile', label: 'Font nomor dada', group: 'files', kind: 'file' },
  { key: 'LegNumbersFile', label: 'Font nomor celana', group: 'files', kind: 'file' },
  { key: 'NameFontFile', label: 'Font nama', group: 'files', kind: 'file' },

  { key: 'ShirtColor1', label: 'Warna baju 1', group: 'colors', kind: 'color' },
  { key: 'ShirtColor2', label: 'Warna baju 2', group: 'colors', kind: 'color' },
  { key: 'UndershirtColor', label: 'Warna undershirt', group: 'colors', kind: 'color' },
  { key: 'ShortsColor', label: 'Warna celana', group: 'colors', kind: 'color' },
  { key: 'SocksColor', label: 'Warna kaus kaki', group: 'colors', kind: 'color' },
  { key: 'UniColor_Color1', label: 'UniColor 1', group: 'colors', kind: 'color' },
  { key: 'UniColor_Color2', label: 'UniColor 2', group: 'colors', kind: 'color' },

  { key: 'RightShortX', label: 'Kanan, pendek, X', group: 'badges', min: 0, max: 31 },
  { key: 'RightShortY', label: 'Kanan, pendek, Y', group: 'badges', min: 0, max: 31 },
  { key: 'RightLongX', label: 'Kanan, panjang, X', group: 'badges', min: 0, max: 31 },
  { key: 'RightLongY', label: 'Kanan, panjang, Y', group: 'badges', min: 0, max: 31 },
  { key: 'LeftShortX', label: 'Kiri, pendek, X', group: 'badges', min: 0, max: 31 },
  { key: 'LeftShortY', label: 'Kiri, pendek, Y', group: 'badges', min: 0, max: 31 },
  { key: 'LeftLongX', label: 'Kiri, panjang, X', group: 'badges', min: 0, max: 31 },
  { key: 'LeftLongY', label: 'Kiri, panjang, Y', group: 'badges', min: 0, max: 31 },
];

/** Starting config: the layout of the widely used 2022 batch-update configs. */
export const DEFAULT_KIT_CONFIG = `; shirt parameters
ShortSleevesModel=1                               ; 1=Normal (players), 2=Kappa (players), 3=Referee kits only
ShirtModel=144                                    ; 144, 151=Semi-long short sleeves, 160, 176=Legacy
Collar=1                                          ; 1 to 130
TightKit=0                                        ; 0=Off, 1=On
ShirtPattern=0                                    ; 0 to 6
WinterCollar=1                                    ; 1 to 130
LongSleevesType=62                                ; 62=Normal & Undershirt, 187=Only Undershirt

; shirt - back side
Name=0                                            ; 0=On, 1=Off
NameShape=0                                       ; 0=Straight, 1=Light curve, 2=Medium curve, 3=Extreme curve
NameY=15                                          ; 0 to 39
NameSize=6                                        ; 0 to 20
NameStretch=2                                     ; 0 to 3
BackNumberY=18                                    ; 0 to 29
BackNumberSize=24                                 ; 0 to 28
BackNumberSpacing=10                              ; 0 to 14
BackNumberType=0                                  ; 0=Normal, 1=Forced two-digit

; shirt - front side
ChestNumberX=15                                   ; 0 to 29
ChestNumberY=6                                    ; 0 to 29
ChestNumberSize=16                                ; 0 to 28

; shorts parameters
ShortsModel=1                                     ; 1 to 16 (17 and above tend make some parts of the pants black)
ShortsNumberSide=1                                ; 0=Left, 1=Right
ShortsNumberX=16                                  ; 0 to 31 (number invisible if using 30 or 31)
ShortsNumberY=4                                   ; 0 to 31 (number invisible if using 30 or 31)
ShortsNumberSize=16                               ; 0 to 28

; texture files
KitFile=kit
BackNumbersFile=
ChestNumbersFile=
LegNumbersFile=
NameFontFile=

; kit colors
ShirtColor1=#FFFFFF
ShirtColor2=#000000
UndershirtColor=#FFFFFF
ShortsColor=#FFFFFF
SocksColor=#FFFFFF

; sleeve badge positions
RightShortX=15                                    ; 0 to 31
RightShortY=15                                    ; 0 to 31
RightLongX=15                                     ; 0 to 31
RightLongY=15                                     ; 0 to 31
LeftShortX=15                                     ; 0 to 31
LeftShortY=15                                     ; 0 to 31
LeftLongX=15                                      ; 0 to 31
LeftLongY=15                                      ; 0 to 31

; kit colors from UniColor.bin
UniColor_Color1=#FFFFFF
UniColor_Color2=#000000
`;

const LINE_RE = /^\s*([\w]+)\s*=\s*"?([^"]*)/;

/** key -> value, read like kserv's load_config (BOM and ; comments stripped, value trimmed). */
export function parseKitConfig(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const m = raw.replace(/;.*/, '').match(LINE_RE);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const ADDED_HEADER = '; values added by Okarin Kit Editor';

/** Change (or add) one key, keeping the comment and the 50-column padding kserv's save_config writes. */
export function setKitConfigValue(text: string, key: string, value: string): string {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const i = lines.findIndex((l) => l.replace(/;.*/, '').match(LINE_RE)?.[1] === key);
  if (i >= 0) {
    const comment = lines[i].match(/;.*/)?.[0] ?? '';
    const kv = `${key}=${value}`;
    lines[i] = comment ? kv.padEnd(50) + comment : kv;
    return lines.join('\n');
  }
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  if (!lines.includes(ADDED_HEADER)) lines.push('', ADDED_HEADER);
  lines.push(`${key}=${value}`, '');
  return lines.join('\n');
}

/** Problems a value has against kserv's limits (empty = fine). */
export function kitConfigIssue(field: KitConfigField, value: string | undefined): string | null {
  if (value === undefined || value === '') return field.kind === 'file' || field.def !== undefined ? null : 'kosong';
  if (field.kind === 'color') return /^#[0-9a-fA-F]{6}$/.test(value) ? null : 'harus #RRGGBB';
  if (field.kind === 'file') return /[\\/.\s]/.test(value) ? 'tanpa folder, spasi atau ekstensi' : null;
  const n = Number(value);
  if (!Number.isInteger(n)) return 'harus angka';
  if (field.options) return field.options.some(([v]) => v === n) ? null : 'nilai tidak dikenal';
  if (field.min !== undefined && n < field.min) return `min ${field.min}`;
  if (field.max !== undefined && n > field.max) return `maks ${field.max}`;
  return null;
}

/** Text written to disk: CRLF like the configs PES modders share. */
export const kitConfigToFile = (text: string) => text.replace(/\r?\n/g, '\r\n');

// self-check of the round trip (runs once at import, cheap)
{
  const t = setKitConfigValue(setKitConfigValue(DEFAULT_KIT_CONFIG, 'Collar', '42'), 'CaptainArmband', '2');
  const p = parseKitConfig(t);
  if (p.Collar !== '42' || p.CaptainArmband !== '2' || p.ChestNumbersFile !== '' || !t.includes('Collar=42' + ' '.repeat(41) + '; 1 to 130')) {
    console.error('kitConfig self-check failed');
  }
}
