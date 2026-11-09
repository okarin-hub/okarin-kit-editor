/**
 * Activity log: what the user does in the app (buttons, menus, tabs, settings, shortcuts, alerts, errors), written
 * to library/logs/aktivitas-YYYY-MM-DD.log, so a problem can be traced back step by step. Only labels and setting
 * values are kept, no pictures or file contents.
 */
import { APP_VERSION } from '@/lib/updateCheck';

const queue: string[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;

const stamp = () => {
  const d = new Date();
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
};

const flush = () => {
  timer = null;
  if (!queue.length) return;
  const lines = queue.splice(0, 300);
  fetch('/api/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lines }), keepalive: true }).catch(() => {});
  if (queue.length) timer = setTimeout(flush, 500);
};

/** Adds one entry ("klik", "ubah", "error"...). */
export function logActivity(kind: string, text: string) {
  queue.push(`${stamp()} ${kind.padEnd(8)} ${text}`);
  if (!timer) timer = setTimeout(flush, 1500);
}

const clean = (s: string | null | undefined, max = 70) => (s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** The readable name of a control: its aria-label, its text, its title, or the text of its label. */
function nameOf(el: Element): string {
  const label = el.closest('label');
  return (
    clean(el.getAttribute('aria-label')) ||
    clean((el as HTMLElement).innerText) ||
    clean(el.getAttribute('title')) ||
    clean(label?.innerText) ||
    clean(el.getAttribute('placeholder')) ||
    el.tagName.toLowerCase()
  );
}

/** Where the control is: the open dialog's title, else the side panel tab that is selected. */
function placeOf(el: Element): string {
  const dialog = el.closest('[role="dialog"]');
  // the title's own text, without a badge next to it ("Eksp.")
  const h = dialog?.querySelector('h2,h3');
  if (h) return clean(h.childNodes[0]?.textContent || h.textContent, 40);
  return '';
}

const describe = (el: Element) => {
  const place = placeOf(el);
  return `${place ? `[${place}] ` : ''}"${nameOf(el)}"`;
};

/** Starts the global listeners once (from the page). */
export function startActivityLog() {
  if (started || typeof window === 'undefined') return;
  started = true;
  logActivity('mulai', `Okarin Kit Editor ${APP_VERSION} · ${window.innerWidth}×${window.innerHeight} · ${navigator.language}`);

  document.addEventListener(
    'click',
    (e) => {
      const el = (e.target as Element | null)?.closest('button,a,[role="menuitem"],[role="tab"],[role="option"],summary');
      if (el) logActivity('klik', describe(el));
    },
    true
  );

  // settings: checkboxes, selects, sliders, colours and typed text (when it is committed)
  document.addEventListener(
    'change',
    (e) => {
      const el = e.target as HTMLInputElement | HTMLSelectElement | null;
      if (!el || !('value' in el)) return;
      let value: string;
      if (el instanceof HTMLSelectElement) value = clean(el.selectedOptions[0]?.text ?? el.value);
      else if (el.type === 'checkbox' || el.type === 'radio') value = el.checked ? 'ya' : 'tidak';
      else if (el.type === 'file') value = Array.from(el.files ?? []).map((f) => `${f.name} (${Math.round(f.size / 1024)} KB)`).join(', ') || '-';
      else value = clean(el.value, 80);
      logActivity('ubah', `${describe(el)} = ${value}`);
    },
    true
  );

  // shortcuts (with Ctrl / Alt / Cmd) and the keys that act on a selection
  window.addEventListener(
    'keydown',
    (e) => {
      const t = e.target as HTMLElement;
      const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable;
      if (e.ctrlKey || e.metaKey || e.altKey) {
        if (['Control', 'Alt', 'Meta', 'Shift'].includes(e.key)) return;
        logActivity('tombol', `${e.ctrlKey ? 'Ctrl+' : ''}${e.metaKey ? 'Cmd+' : ''}${e.altKey ? 'Alt+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.key}`);
      } else if (!typing && ['Delete', 'Backspace', 'Escape', 'Enter'].includes(e.key)) {
        logActivity('tombol', e.key);
      }
    },
    true
  );

  // messages the app shows the user (most failures end in an alert)
  const alert0 = window.alert.bind(window);
  window.alert = (msg?: unknown) => {
    logActivity('alert', clean(String(msg), 400));
    alert0(msg as string);
  };
  const confirm0 = window.confirm.bind(window);
  window.confirm = (msg?: string) => {
    const ok = confirm0(msg);
    logActivity('konfirm', `${clean(msg, 300)} → ${ok ? 'ya' : 'batal'}`);
    return ok;
  };

  window.addEventListener('error', (e) => logActivity('error', clean(`${e.message} @ ${e.filename?.split('/').pop()}:${e.lineno}`, 400)));
  window.addEventListener('unhandledrejection', (e) => logActivity('error', clean(`promise: ${(e.reason as Error)?.message ?? e.reason}`, 400)));
  window.addEventListener('pagehide', () => {
    logActivity('tutup', 'halaman ditutup / dimuat ulang');
    if (timer) clearTimeout(timer);
    // fetch with keepalive outlives the page (a JSON sendBeacon is refused by Chrome)
    flush();
  });
}
