import React, { createContext, useContext, useEffect, useState } from "react";
import { translations } from './translations/index';

export type Locale = "ar" | "en" | "fr";

type I18nContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => {
    try {
      const stored = localStorage.getItem("locale");
      return (stored as Locale) || "ar";
    } catch {
      return "ar";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("locale", locale);
      if (typeof document !== "undefined") {
        document.documentElement.lang = locale;
        document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
        document.documentElement.classList.remove("rtl", "ltr");
        document.documentElement.classList.add(locale === "ar" ? "rtl" : "ltr");
      }
    } catch {}
  }, [locale]);

  function humanizeKey(key: string): string {
    // Convert keys like "header.ecommercePlatform" or "billing.cancelled.title" to readable labels.
    // If the key ends with a generic suffix like "title"/"subtitle"/"desc", strip that suffix first.
    const parts = key.split(".").filter(Boolean);
    const genericSuffixes = new Set([
      "title",
      "tittle", // common misspelling seen in UIs
      "subtitle",
      "desc",
      "description",
      "label",
      "placeholder",
      "cta",
      "button",
      "name",
      "text",
      "message",
    ]);

    while (parts.length > 1 && genericSuffixes.has(parts[parts.length - 1].toLowerCase())) {
      parts.pop();
    }

    const raw = parts[parts.length - 1] || key;
    const withSpaces = raw
      .replace(/[_-]+/g, " ")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .trim();
    if (!withSpaces) return "";

    // Title-case words, keep short connectors lowercase
    const lower = new Set(["and", "or", "the", "a", "an", "of", "to", "in", "on", "for", "with"]);
    return withSpaces
      .split(/\s+/)
      .map((word, idx) => {
        const w = word.toLowerCase();
        if (idx !== 0 && lower.has(w)) return w;
        return w.charAt(0).toUpperCase() + w.slice(1);
      })
      .join(" ");
  }

  function t(key: string, params?: Record<string, string | number>): string {
    // Prefer current locale; fallback to English; never expose raw keys to end-users
    let value = translations[locale]?.[key] ?? translations["en"]?.[key];
    if (!value) value = humanizeKey(key);

    if (params && value) {
      Object.entries(params).forEach(([k, val]) => {
        value = value.replace(`{${k}}`, val.toString());
      });
    }

    return value || "";
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslation must be used within an I18nProvider");
  }
  return context;
}
