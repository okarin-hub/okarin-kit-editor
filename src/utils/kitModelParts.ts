import { parseKitConfig } from '@/utils/kitConfig';

/**
 * Which parts of the 3D model (public/model/pes_kit.glb, built by scripts/build-3d-model.cjs) are shown.
 * Collar, shorts model, Kappa sleeves and the tight kit come from the kit config, like in the game;
 * sleeves (short / long / goalkeeper), sock length, captain's armband and a tucked-in shirt are preview choices
 * (the game takes them from the player).
 */
export type SockLength = 'short' | 'middle' | 'long';
export type SleeveKind = 'short' | 'long' | 'gk';

export interface PreviewChoice {
  sleeves: SleeveKind;
  socks: SockLength;
  captain: boolean;
  tucked: boolean;
}

export interface ModelChoice extends PreviewChoice {
  tight: boolean;
  kappa: boolean;
  collar: number; // 1..133
  shortsModel: number; // 1..16
}

/** Collars the 3D model has (the game allows up to 135; 134-135 show collar 1). */
export const COLLARS = 133;
export const SHORTS_MODELS = 16;

const intIn = (v: string | undefined, min: number, max: number, def: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : def;
};

export function modelChoiceFromConfig(configText: string, preview: PreviewChoice): ModelChoice {
  const c = parseKitConfig(configText);
  return {
    tight: c.TightKit === '1',
    kappa: c.ShortSleevesModel === '2',
    collar: intIn(c.Collar, 1, COLLARS, 1),
    // 0 is allowed by kserv; it shows like model 1 here
    shortsModel: intIn(c.ShortsModel, 1, SHORTS_MODELS, 1),
    ...preview,
  };
}

const pad3 = (n: number) => String(n).padStart(3, '0');

/** Whether the model part `name` is shown for this choice (parts with unknown names stay visible). */
export function partVisible(name: string, c: ModelChoice): boolean {
  const body = name.match(/^(shirt|pants)_(out|in)(_tight)?$/);
  if (body) {
    if ((body[2] === 'in') !== c.tucked) return false;
    // there is one tucked-in shorts piece for both shirt cuts
    return body[1] === 'pants' && c.tucked ? true : !!body[3] === c.tight;
  }
  const sleeve = name.match(/^sleeve_(short|long)_(normal|kappa)(_tight)?(_captain)?$/);
  if (sleeve)
    return (
      sleeve[1] === c.sleeves &&
      (sleeve[2] === 'kappa') === c.kappa &&
      !!sleeve[3] === c.tight &&
      !!sleeve[4] === c.captain
    );
  // goalkeeper sleeves: long only, no Kappa cut
  const gk = name.match(/^sleeve_gk(_tight)?(_captain)?$/);
  if (gk) return c.sleeves === 'gk' && !!gk[1] === c.tight && !!gk[2] === c.captain;
  if (name.startsWith('pants_leg_')) return name === `pants_leg_${pad3(c.shortsModel)}`;
  if (name.startsWith('socks_')) return name === `socks_${c.socks}`;
  if (name.startsWith('collar_')) return name === `collar_${pad3(c.collar)}`;
  return true;
}

// self-check (runs once at import, cheap)
{
  const names = ['shirt_out', 'shirt_out_tight', 'shirt_in', 'shirt_in_tight', 'pants_out', 'pants_out_tight', 'pants_in',
    'sleeve_long_kappa_tight', 'sleeve_long_kappa', 'sleeve_short_kappa_tight', 'sleeve_long_kappa_tight_captain',
    'sleeve_gk', 'sleeve_gk_tight', 'sleeve_gk_tight_captain', 'pants_leg_001', 'pants_leg_002', 'socks_long',
    'socks_middle', 'collar_042', 'collar_001'];
  const shown = (cfg: string, p: PreviewChoice) => names.filter((n) => partVisible(n, modelChoiceFromConfig(cfg, p))).join(',');
  const a = shown('Collar=42\nTightKit=1\nShortSleevesModel=2\nShortsModel=0', { sleeves: 'long', socks: 'long', captain: false, tucked: false });
  const b = shown('Collar=1\nTightKit=0', { sleeves: 'gk', socks: 'middle', captain: false, tucked: true });
  const c = shown('TightKit=1\nShortSleevesModel=2', { sleeves: 'long', socks: 'middle', captain: true, tucked: true });
  if (
    a !== 'shirt_out_tight,pants_out_tight,sleeve_long_kappa_tight,pants_leg_001,socks_long,collar_042' ||
    b !== 'shirt_in,pants_in,sleeve_gk,pants_leg_001,socks_middle,collar_001' ||
    c !== 'shirt_in_tight,pants_in,sleeve_long_kappa_tight_captain,pants_leg_001,socks_middle,collar_001'
  ) {
    console.error('kitModelParts self-check failed:', { a, b, c });
  }
}
