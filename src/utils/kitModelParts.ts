import { parseKitConfig } from '@/utils/kitConfig';

/**
 * Which parts of the 3D model (public/model/pes_kit.glb, built by scripts/build-3d-model.cjs) are shown.
 * Collar, shorts model, Kappa sleeves and the tight kit come from the kit config, like in the game;
 * sleeve length and sock length are preview choices.
 */
export type SockLength = 'short' | 'middle' | 'long';

export interface ModelChoice {
  tight: boolean;
  kappa: boolean;
  longSleeves: boolean;
  collar: number; // 1..133
  shortsModel: number; // 1..16
  socks: SockLength;
}

/** Collars the 3D model has (the game allows up to 135; 134-135 show collar 1). */
export const COLLARS = 133;
export const SHORTS_MODELS = 16;

const intIn = (v: string | undefined, min: number, max: number, def: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : def;
};

export function modelChoiceFromConfig(
  configText: string,
  preview: { longSleeves: boolean; socks: SockLength }
): ModelChoice {
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
  if (name === 'shirt_out') return !c.tight;
  if (name === 'shirt_out_tight') return c.tight;
  if (name === 'pants_out') return !c.tight;
  if (name === 'pants_out_tight') return c.tight;
  const sleeve = name.match(/^sleeve_(short|long)_(normal|kappa)(_tight)?$/);
  if (sleeve)
    return (sleeve[1] === 'long') === c.longSleeves && (sleeve[2] === 'kappa') === c.kappa && !!sleeve[3] === c.tight;
  if (name.startsWith('pants_leg_')) return name === `pants_leg_${pad3(c.shortsModel)}`;
  if (name.startsWith('socks_')) return name === `socks_${c.socks}`;
  if (name.startsWith('collar_')) return name === `collar_${pad3(c.collar)}`;
  return true;
}

// self-check (runs once at import, cheap)
{
  const c = modelChoiceFromConfig('Collar=42\nTightKit=1\nShortSleevesModel=2\nShortsModel=0', { longSleeves: true, socks: 'long' });
  const shown = ['shirt_out', 'shirt_out_tight', 'sleeve_long_kappa_tight', 'sleeve_long_kappa', 'sleeve_short_kappa_tight',
    'pants_leg_001', 'pants_leg_002', 'socks_long', 'socks_middle', 'collar_042', 'collar_001', 'pants_out_tight']
    .filter((n) => partVisible(n, c)).join(',');
  if (shown !== 'shirt_out_tight,sleeve_long_kappa_tight,pants_leg_001,socks_long,collar_042,pants_out_tight') {
    console.error('kitModelParts self-check failed:', shown);
  }
}
