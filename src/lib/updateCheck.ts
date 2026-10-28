/** Version of this build (from package.json, set in next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0';

/** Project page; the update check reads the latest release from the same repository. */
export const PROJECT_URL = 'https://github.com/okarin-hub/okarin-kit-editor';

/** Release feed (GitHub "latest release" format). Can be pointed elsewhere with NEXT_PUBLIC_UPDATE_FEED_URL. */
export const UPDATE_FEED_URL =
  process.env.NEXT_PUBLIC_UPDATE_FEED_URL || 'https://api.github.com/repos/okarin-hub/okarin-kit-editor/releases/latest';

export type UpdateResult =
  | { status: 'latest'; current: string }
  | { status: 'available'; current: string; latest: string; notes: string; url: string }
  | { status: 'error' };

/** Compares dotted versions: positive when a is newer than b. */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Reads the release feed and tells whether a newer version exists. A private or unreachable feed gives 'error'. */
export async function checkForUpdate(): Promise<UpdateResult> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(UPDATE_FEED_URL, { signal: ctrl.signal, headers: { Accept: 'application/vnd.github+json' } });
    clearTimeout(timer);
    if (!res.ok) return { status: 'error' };
    const data = await res.json();
    const latest = String(data.tag_name ?? data.version ?? '').trim();
    if (!latest) return { status: 'error' };
    if (compareVersions(latest, APP_VERSION) > 0) {
      return {
        status: 'available',
        current: APP_VERSION,
        latest: latest.replace(/^v/i, ''),
        notes: String(data.body ?? '').slice(0, 800),
        url: String(data.html_url ?? PROJECT_URL),
      };
    }
    return { status: 'latest', current: APP_VERSION };
  } catch {
    return { status: 'error' };
  }
}
