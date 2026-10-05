import { useState, useEffect } from "react";
import { useLanguage } from "../../context/LanguageContext";
import api from "../../services/api";

export default function TranslationSettings() {
    const { frontendGtsKey, updateGtsKey } = useLanguage();
    const [apiKey, setApiKey] = useState(frontendGtsKey || "");
    const [status, setStatus] = useState("");
    const [testing, setTesting] = useState(false);
    const [backendActive, setBackendActive] = useState(false);

    const envKey = import.meta.env.VITE_GOOGLE_TRANSLATE_API_KEY || import.meta.env.VITE_GOOGLE_TRANSLATION_API_KEY || "";

    useEffect(() => {
        api.get("/translation/status")
            .then((res) => {
                if (res.data?.success && res.data?.configured) {
                    setBackendActive(true);
                } else {
                    setBackendActive(false);
                }
            })
            .catch(() => setBackendActive(false));
    }, []);

    async function testKey() {
        setTesting(true);
        setStatus("Testing Google Translate connection...");

        // 1. If frontend key entered, test direct frontend API
        if (apiKey.trim()) {
            try {
                const response = await fetch(
                    `https://translation.googleapis.com/language/translate/v2?key=${apiKey.trim()}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ q: "Hello", target: "hi", format: "text" }),
                    }
                );
                const data = await response.json();
                if (response.ok && data?.data?.translations?.[0]?.translatedText) {
                    updateGtsKey(apiKey.trim());
                    setStatus(`✅ Frontend Key connected! Test Translation: "Hello" → "${data.data.translations[0].translatedText}"`);
                    setTesting(false);
                    return;
                } else {
                    setStatus(`❌ ${data?.error?.message || "Invalid Google Translate API Key."}`);
                    setTesting(false);
                    return;
                }
            } catch (err) {
                setStatus("❌ Network error connecting to Google Translation API.");
                setTesting(false);
                return;
            }
        }

        // 2. Test Backend Translation API (server/.env GOOGLE_TRANSLATE_API_KEY)
        try {
            const res = await api.post("/translation/translate", { text: "Hello", targetLang: "hi" });
            if (res.data?.success && res.data?.translatedText) {
                setBackendActive(true);
                setStatus(`✅ Backend Google Translation API active! Test: "Hello" → "${res.data.translatedText}"`);
            } else {
                setStatus(`❌ ${res.data?.message || "Backend Translation Key not working or not configured in server/.env."}`);
            }
        } catch (err) {
            setStatus(err.response?.data?.message || "❌ Backend Google Translation API key is missing or invalid in server/.env.");
        } finally {
            setTesting(false);
        }
    }

    function saveKey() {
        if (!apiKey.trim()) {
            removeKey();
            return;
        }
        updateGtsKey(apiKey.trim());
        setStatus("✅ Google Translate API Key saved locally.");
    }

    function removeKey() {
        updateGtsKey("");
        setApiKey("");
        setStatus("User Google Translate API Key removed. Reverting to backend server .env key.");
    }

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-[#E8E0D5] dark:border-slate-800 p-6 transition-colors duration-200">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                🌐 Google Translate API Configuration
            </h2>

            <p className="mt-3 text-slate-600 dark:text-slate-400 text-sm leading-6">
                MedJarvis provides instantaneous multi-language support (Hindi, Kannada, Marathi, Tamil, Telugu) via built-in local JSON dictionaries. 
                Configuring a Google Cloud Translation API Key in your backend <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-emerald-600 dark:text-emerald-400">server/.env</code> enables live, dynamic AI translation for any text across all pages.
            </p>

            <div className="mt-6">
                <label className="font-medium text-slate-700 dark:text-slate-300 text-sm">
                    Optional User Override Key (Cloud Translation API v2)
                </label>

                <input
                    type="password"
                    className="border border-[#E8E0D5] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl p-4 w-full mt-2 outline-none focus:ring-2 focus:ring-[#2D6A4F] text-sm"
                    placeholder="Paste personal Google Cloud Translation API Key if overriding server key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                />
            </div>

            <div className="flex flex-wrap gap-3 mt-6">
                {apiKey.trim() && (
                    <button
                        onClick={saveKey}
                        className="bg-[#2D6A4F] hover:bg-[#245740] dark:bg-emerald-600 dark:hover:bg-emerald-500 px-6 py-3 rounded-xl text-white font-bold text-sm transition"
                    >
                        Save Key
                    </button>
                )}

                <button
                    onClick={testKey}
                    disabled={testing}
                    className="bg-[#2D6A4F] hover:bg-[#245740] text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 px-6 py-3 rounded-xl font-bold text-sm transition disabled:opacity-50"
                >
                    {testing ? "Testing..." : "Test Translation API Connection"}
                </button>

                {apiKey && (
                    <button
                        onClick={removeKey}
                        className="border border-[#E8E0D5] dark:border-slate-700 text-slate-800 dark:text-slate-200 px-6 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 font-bold text-sm transition"
                    >
                        Remove Personal Key
                    </button>
                )}
            </div>

            {status && (
                <div
                    className={`mt-6 rounded-xl p-4 text-sm font-medium ${
                        status.startsWith("✅")
                            ? "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300 border border-green-300 dark:border-green-800"
                            : status.startsWith("Testing")
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800"
                            : "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-300 dark:border-red-800"
                    }`}
                >
                    {status}
                </div>
            )}

            <div className="mt-6 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-[#E8E0D5] dark:border-slate-700 p-4">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                    Current Active Translation Engine
                </h3>

                <p className="mt-1.5 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2">
                    {apiKey.trim()
                        ? "✅ Personal User Key (Browser LocalStorage)"
                        : envKey
                        ? "⚙ Frontend Environment (.env) VITE_GOOGLE_TRANSLATE_API_KEY"
                        : backendActive
                        ? "✅ Active Backend Server API Key (server/.env GOOGLE_TRANSLATE_API_KEY)"
                        : "📖 Local JSON Dictionaries (Built-in Multilingual System)"}
                </p>
            </div>

            <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
                className="inline-block mt-6 text-emerald-600 dark:text-emerald-400 hover:underline font-medium text-sm"
            >
                🔗 Get Google Cloud Translation API Key from Google Cloud Console
            </a>
        </div>
    );
}
