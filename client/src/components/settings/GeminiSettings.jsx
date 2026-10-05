import { useState } from "react";
import api from "../../services/api";

export default function GeminiSettings() {

    const [apiKey, setApiKey] = useState(
        localStorage.getItem("geminiKey") || ""
    );

    const [status, setStatus] = useState("");

    const usingUserKey = apiKey.trim() !== "";

    async function testKey() {

        if (!apiKey.trim()) {

            setStatus("❌ Please enter a Gemini API Key.");

            return;

        }

        setStatus("Testing Gemini connection...");

        try {

            const res = await api.post("/ai/test-key", {
                apiKey,
            });

            if (res.data.success) {

                localStorage.setItem(
                    "geminiKey",
                    apiKey
                );

                setStatus("✅ Gemini connected successfully.");

            }

        } catch (err) {

            setStatus(
                err.response?.data?.message ||
                "❌ Invalid Gemini API Key."
            );

        }

    }

    function removeKey() {

        localStorage.removeItem("geminiKey");

        setApiKey("");

        setStatus("User Gemini API Key removed.");

    }

    return (

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border dark:border-slate-800 p-6">

            <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">

                🤖 Gemini AI Configuration

            </h2>

            <p className="mt-3 text-slate-600 dark:text-slate-400">

                MedJarvis first checks for a backend Gemini API key.
                If none is available, it automatically uses your
                personal Gemini API key stored in this browser.

            </p>

            <div className="mt-6">

                <label className="font-medium text-slate-700 dark:text-slate-300">

                    Gemini API Key

                </label>

                <input

                    type="password"

                    className="border border-[#E8E0D5] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl p-4 w-full mt-2 outline-none focus:ring-2 focus:ring-[#2D6A4F]"

                    placeholder="Paste your Gemini API Key"

                    value={apiKey}

                    onChange={(e) =>
                        setApiKey(e.target.value)
                    }

                />

            </div>

            <div className="flex gap-4 mt-6">

                <button

                    onClick={testKey}

                    disabled={!apiKey}

                    className={`px-6 py-3 rounded-xl text-white font-bold transition ${

                        apiKey

                            ? "bg-[#2D6A4F] hover:bg-[#245740] dark:bg-emerald-600 dark:hover:bg-emerald-500"

                            : "bg-gray-400 dark:bg-slate-700 cursor-not-allowed"

                    }`}

                >

                    Test Key

                </button>

                <button

                    onClick={removeKey}

                    className="border border-[#E8E0D5] dark:border-slate-700 text-slate-800 dark:text-slate-200 px-6 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 font-bold transition"

                >

                    Remove

                </button>

            </div>

            {status && (

                <div

                    className={`mt-6 rounded-xl p-4 font-medium ${

                        status.startsWith("✅")

                            ? "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300 border border-green-300 dark:border-green-800"

                            : status.startsWith("Testing")

                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800"

                            : "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-300 dark:border-red-800"

                    }`}

                >

                    {status}

                </div>

            )}

            <div className="mt-6 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-[#E8E0D5] dark:border-slate-700 p-4">

                <h3 className="font-semibold text-slate-900 dark:text-slate-100">

                    Current AI Source

                </h3>

                <p className="mt-2 text-slate-600 dark:text-slate-300">

                    {usingUserKey
                        ? "✅ Personal Gemini API Key"
                        : "⚙ Backend (.env) Gemini API Key"}

                </p>

            </div>

            <a

                href="https://aistudio.google.com/app/apikey"

                target="_blank"

                rel="noreferrer"

                className="inline-block mt-6 text-emerald-600 dark:text-emerald-400 hover:underline font-medium"

            >

                🔗 Get Free Gemini API Key

            </a>

        </div>

    );

}