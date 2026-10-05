import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../services/api";

import en from "../locales/en.json";
import hi from "../locales/hi.json";
import kn from "../locales/kn.json";
import mr from "../locales/mr.json";
import ta from "../locales/ta.json";
import te from "../locales/te.json";

const LOCALES = {
  English: { code: "en", dict: en },
  "हिन्दी": { code: "hi", dict: hi },
  "ಕನ್ನಡ": { code: "kn", dict: kn },
  "मराठी": { code: "mr", dict: mr },
  "தமிழ்": { code: "ta", dict: ta },
  "తెలుగు": { code: "te", dict: te },
};

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      return localStorage.getItem("medjarvis_language") || "English";
    } catch {
      return "English";
    }
  });

  const [frontendGtsKey, setFrontendGtsKey] = useState(() => {
    try {
      return (
        localStorage.getItem("medjarvis_gts_key") ||
        import.meta.env.VITE_GOOGLE_TRANSLATE_API_KEY ||
        import.meta.env.VITE_GOOGLE_TRANSLATION_API_KEY ||
        ""
      );
    } catch {
      return (
        import.meta.env.VITE_GOOGLE_TRANSLATE_API_KEY ||
        import.meta.env.VITE_GOOGLE_TRANSLATION_API_KEY ||
        ""
      );
    }
  });

  // Dynamic Google translation cache map persisted in localStorage
  const [dynamicCache, setDynamicCache] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("medjarvis_gts_cache") || "{}");
    } catch {
      return {};
    }
  });

  const updateCache = useCallback((key, value) => {
    setDynamicCache((prev) => {
      const updated = { ...prev, [key]: value };
      try {
        localStorage.setItem("medjarvis_gts_cache", JSON.stringify(updated));
      } catch (e) {
        /* ignore */
      }
      return updated;
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("medjarvis_language", language);
    } catch (e) {
      console.warn("Could not save language preference:", e);
    }
  }, [language]);

  const setLanguage = (langLabel) => {
    if (LOCALES[langLabel]) {
      setLanguageState(langLabel);
    }
  };

  const updateGtsKey = (key) => {
    setFrontendGtsKey(key);
    try {
      localStorage.setItem("medjarvis_gts_key", key);
    } catch (e) {
      /* ignore */
    }
  };

  const currentConfig = LOCALES[language] || LOCALES.English;
  const targetLangCode = currentConfig.code;

  /**
   * Helper to resolve local translation string from dictionary
   * Checks direct key, normalized key, case-insensitive key, and English dictionary value mappings.
   */
  const resolveDictValue = useCallback((dict, key) => {
    if (!dict || !key) return null;

    const strKey = String(key).trim();

    // 1. Direct match
    if (dict[strKey]) return dict[strKey];

    // 2. Normalized key (e.g. "Welcome Back" -> "welcome_back")
    const normKey = strKey.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    if (dict[normKey]) return dict[normKey];

    // 3. Case-insensitive key match in dict
    const lowerKey = strKey.toLowerCase();
    for (const [k, v] of Object.entries(dict)) {
      if (k.toLowerCase().trim() === lowerKey) {
        return v;
      }
    }

    // 4. Match against English dictionary keys or values
    for (const [k, v] of Object.entries(en)) {
      if (
        k === strKey ||
        k === normKey ||
        (typeof v === "string" && v.toLowerCase().trim() === lowerKey)
      ) {
        if (dict[k]) return dict[k];
      }
    }

    return null;
  }, []);


  // Track pending translation fetch requests to avoid duplicate API calls
  const pendingFetches = useState(() => new Set())[0];

  const fetchDynamicTranslation = useCallback((text, langCode) => {
    if (!text || langCode === "en") return;
    const cacheKey = `${langCode}:${text}`;

    if (dynamicCache[cacheKey] || pendingFetches.has(cacheKey)) {
      return;
    }
    pendingFetches.add(cacheKey);

    // 1. Try Backend GTS Proxy (POST /api/translation/translate)
    api.post("/translation/translate", { text, targetLang: langCode })
      .then((res) => {
        if (res.data?.success && res.data?.translatedText) {
          updateCache(cacheKey, res.data.translatedText);
        }
      })
      .catch((err) => {
        if (err.response?.data?.rateLimited) {
          console.warn("⚠️ Google Translation API rate limit reached. Using local dictionary fallback.");
          return;
        }

        // 2. Try Frontend GTS Key if available
        if (frontendGtsKey) {
          fetch(`https://translation.googleapis.com/language/translate/v2?key=${frontendGtsKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ q: text, target: langCode, format: "text" }),
          })
            .then((r) => r.json())
            .then((data) => {
              if (data?.data?.translations?.[0]?.translatedText) {
                updateCache(cacheKey, data.data.translations[0].translatedText);
              }
            })
            .catch(() => {});
        }
      })
      .finally(() => {
        pendingFetches.delete(cacheKey);
      });
  }, [dynamicCache, frontendGtsKey, pendingFetches, updateCache]);

  /**
   * Main Translation Helper Function t(key, fallbackText)
   * 
   * Priority Order:
   * 1. Local JSON dictionary match for current language (intelligent resolution)
   * 2. Cached dynamic GTS translation if available
   * 3. Background GTS query (if key not in local JSON and target language is not English)
   * 4. English dictionary / fallback text or key string
   */
  const t = useCallback((key, fallbackText = "") => {
    if (!key) return fallbackText || "";

    // 1. Local JSON dictionary match for current language
    const localMatch = resolveDictValue(currentConfig.dict, key);
    if (localMatch) {
      return localMatch;
    }

    // 2. Check dynamic cache if key was translated dynamically via GTS
    const cacheKey = `${targetLangCode}:${key}`;
    if (dynamicCache[cacheKey]) {
      return dynamicCache[cacheKey];
    }

    // 3. Trigger dynamic GTS fetch in background if not English
    if (targetLangCode !== "en") {
      fetchDynamicTranslation(key, targetLangCode);
    }

    // 4. Fallback to English dictionary if key exists there
    const enMatch = resolveDictValue(en, key);
    if (enMatch) {
      return enMatch;
    }

    return fallbackText || key;
  }, [currentConfig, targetLangCode, dynamicCache, resolveDictValue, fetchDynamicTranslation]);



  /**
   * Translate Dynamic / System Text using Google Translation Pipeline
   * Priority Order:
   * 1. Backend GTS endpoint (POST /api/translation/translate)
   * 2. Frontend User GTS Key (if configured)
   * 3. Local JSON fallback
   * 4. Original text
   */
  const translateDynamic = useCallback(async (text) => {
    if (!text || targetLangCode === "en") return text;

    const cacheKey = `${targetLangCode}:${text}`;
    if (dynamicCache[cacheKey]) {
      return dynamicCache[cacheKey];
    }

    // PRIORITY 1: Try Backend GTS Endpoint
    try {
      const res = await api.post("/translation/translate", {
        text,
        targetLang: targetLangCode,
      });

      if (res.data?.success && res.data?.translatedText) {
        const translated = res.data.translatedText;
        setDynamicCache(prev => ({ ...prev, [cacheKey]: translated }));
        return translated;
      }
    } catch (err) {
      // Backend GTS unavailable or not configured, proceed to Priority 2
    }

    // PRIORITY 2: Try Frontend User GTS Key if configured
    if (frontendGtsKey) {
      try {
        const response = await fetch(
          `https://translation.googleapis.com/language/translate/v2?key=${frontendGtsKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ q: text, target: targetLangCode, format: "text" }),
          }
        );
        const data = await response.json();
        if (response.ok && data?.data?.translations?.[0]?.translatedText) {
          const translated = data.data.translations[0].translatedText;
          setDynamicCache(prev => ({ ...prev, [cacheKey]: translated }));
          return translated;
        }
      } catch (e) {
        // Frontend GTS key failed, fallback to Priority 3
      }
    }

    // PRIORITY 3: Local JSON dictionary match
    const dict = currentConfig.dict;
    if (dict && dict[text]) {
      return dict[text];
    }

    // PRIORITY 4: Original text
    return text;
  }, [targetLangCode, dynamicCache, frontendGtsKey, currentConfig]);

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        targetLangCode,
        supportedLanguages: Object.keys(LOCALES),
        t,
        translateDynamic,
        frontendGtsKey,
        updateGtsKey,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
