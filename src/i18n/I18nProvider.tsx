'use client';

import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { DEFAULT_LANG, Lang, LANGUAGES, translate } from '@/i18n/engine';

// layout effects run before the browser paints, so the page never shows the Indonesian source text first
const useBeforePaint = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const STORAGE_KEY = 'kit-creator-lang';
const ATTRIBUTES = ['title', 'placeholder', 'alt', 'aria-label'];
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT', 'CODE', 'PRE']);

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Translates a string written in Indonesian (for alert / confirm messages and the like). */
  t: (text: string) => string;
}

const I18nContext = createContext<I18nValue>({ lang: DEFAULT_LANG, setLang: () => {}, t: (s) => s });

export const useI18n = () => useContext(I18nContext);

/**
 * The interface text is written in Indonesian. For the other languages the rendered text is
 * translated in place: every text node and title / placeholder attribute is looked up in the
 * dictionary, and the original text is remembered so switching language (or React re-rendering a
 * changed text) always starts again from the Indonesian source.
 */
// Kept across language changes: the original (Indonesian) text of every node that was translated
const textState = new WeakMap<Text, { orig: string; shown: string }>();
const attrState = new WeakMap<Element, Map<string, { orig: string; shown: string }>>();

function useDomTranslation(lang: Lang) {
  useBeforePaint(() => {
    const skip = (el: Element | null): boolean => {
      for (let e = el; e; e = e.parentElement) {
        if (SKIP_TAGS.has(e.tagName) || e.hasAttribute('data-no-i18n')) return true;
      }
      return false;
    };

    const applyText = (node: Text) => {
      if (skip(node.parentElement)) return;
      const cur = node.nodeValue ?? '';
      const rec = textState.get(node);
      const orig = rec && cur === rec.shown ? rec.orig : cur;
      const out = translate(orig, lang);
      if (out !== cur) node.nodeValue = out;
      textState.set(node, { orig, shown: out });
    };

    const applyAttr = (el: Element, name: string) => {
      const cur = el.getAttribute(name);
      if (cur === null || skip(el)) return;
      let map = attrState.get(el);
      if (!map) {
        map = new Map();
        attrState.set(el, map);
      }
      const rec = map.get(name);
      const orig = rec && cur === rec.shown ? rec.orig : cur;
      const out = translate(orig, lang);
      if (out !== cur) el.setAttribute(name, out);
      map.set(name, { orig, shown: out });
    };

    const applyTree = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) {
        applyText(root as Text);
        return;
      }
      if (root.nodeType !== Node.ELEMENT_NODE) return;
      const el = root as Element;
      if (SKIP_TAGS.has(el.tagName)) return;
      ATTRIBUTES.forEach((a) => applyAttr(el, a));
      el.querySelectorAll(ATTRIBUTES.map((a) => `[${a}]`).join(',')).forEach((child) =>
        ATTRIBUTES.forEach((a) => applyAttr(child, a))
      );
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) applyText(n as Text);
    };

    applyTree(document.body);

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'characterData') applyText(m.target as Text);
        else if (m.type === 'attributes') applyAttr(m.target as Element, m.attributeName!);
        else m.addedNodes.forEach((n) => applyTree(n));
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRIBUTES,
    });

    return () => observer.disconnect();
  }, [lang]);
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  // read the saved language after mount, so the server render and the first client render match
  useBeforePaint(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (saved && LANGUAGES.some((l) => l.code === saved)) setLangState(saved);
    } catch {
      /* storage can be blocked */
    }
    // the page is hidden (see globals.css) until the language is known
    document.documentElement.removeAttribute('data-i18n-pending');
  }, []);

  const setLang = (next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useDomTranslation(lang);

  // alert / confirm / prompt messages are not part of the page, so translate them on the way out
  useEffect(() => {
    if (lang === 'id') return;
    const { alert, confirm, prompt } = window;
    window.alert = (m?: unknown) => alert.call(window, translate(String(m ?? ''), lang));
    window.confirm = (m?: string) => confirm.call(window, translate(String(m ?? ''), lang));
    window.prompt = (m?: string, d?: string) => prompt.call(window, translate(String(m ?? ''), lang), d);
    return () => {
      window.alert = alert;
      window.confirm = confirm;
      window.prompt = prompt;
    };
  }, [lang]);

  const value = useMemo<I18nValue>(() => ({ lang, setLang, t: (s) => translate(s, lang) }), [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export default I18nProvider;
