import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
    AlertCircle,
    Brain,
    Loader2,
    RefreshCw,
    ShieldCheck,
} from "lucide-react";

import api from "../services/api";


export default function AIHealthSummaryPage() {

    const [summary, setSummary] = useState("");
    const [generatedAt, setGeneratedAt] = useState("");
    const [loading, setLoading] = useState(false);
    const [initializing, setInitializing] = useState(true);
    const [error, setError] = useState("");

    const profile = JSON.parse(
        localStorage.getItem("profile") || "{}"
    );


    function getPatientId() {

        if (
            profile?.patient &&
            typeof profile.patient === "object"
        ) {
            return profile.patient?._id || null;
        }

        return (
            profile?.patient ||
            profile?.patientId ||
            null
        );
    }


    const patientId = getPatientId();


    async function generateSummary(regenerate = false) {

        if (!patientId) {

            setError(
                "No patient profile is linked to this account."
            );

            return;
        }


        try {

            setLoading(true);
            setError("");

            const apiKey =
                localStorage.getItem("geminiKey");


            const response = await api.post(
                "/ai/patient-summary",
                {
                    patientId,
                    apiKey,
                    regenerate,
                }
            );


            setSummary(
                response.data?.summary || ""
            );


            if (response.data?.generatedAt) {

                setGeneratedAt(
                    new Date(
                        response.data.generatedAt
                    ).toLocaleString("en-IN")
                );

            }

        } catch (err) {

            console.error(
                "AI Health Summary error:",
                err
            );

            setError(
                err.response?.data?.message ||
                "Unable to generate AI Health Summary."
            );

        } finally {

            setLoading(false);

        }

    }


    useEffect(() => {

        /*
         * Do not automatically consume Gemini API quota
         * when the page opens.
         *
         * The user can explicitly Generate/Regenerate.
         */
        setInitializing(false);

    }, []);


    if (initializing) {

        return (
            <div
                className="
                    min-h-[55vh]
                    flex
                    items-center
                    justify-center
                "
            >

                <Loader2
                    size={42}
                    className="
                        animate-spin
                        text-[#2D6A4F]
                    "
                />

            </div>
        );

    }


    return (
        <div
            className="
                max-w-6xl
                mx-auto
                space-y-7
            "
        >

            {/* HEADER */}

            <div>

                <div
                    className="
                        inline-flex
                        items-center
                        gap-2
                        px-3
                        py-1.5
                        rounded-full
                        bg-[#D8F3DC]
                        dark:bg-emerald-950
                        text-[#1B4332]
                        dark:text-emerald-300
                        text-sm
                        font-bold
                        mb-3
                    "
                >

                    <Brain size={16} />

                    AI-Assisted Health Intelligence

                </div>


                <h1
                    className="
                        text-3xl
                        sm:text-4xl
                        font-bold
                        text-[#1B4332]
                        dark:text-emerald-400
                    "
                >
                    AI Health Summary
                </h1>


                <p
                    className="
                        mt-2
                        text-slate-700
                        dark:text-slate-300
                        font-medium
                        text-base
                        sm:text-lg
                    "
                >
                    A consolidated summary of the patient's available
                    healthcare information.
                </p>

            </div>


            {/* WARNING */}

            <div
                className="
                    rounded-2xl
                    border
                    border-[#E8E0D5]
                    dark:border-emerald-900/50
                    bg-[#FFF8F1]
                    dark:bg-emerald-950/20
                    p-5
                    flex
                    gap-3
                "
            >

                <ShieldCheck
                    size={23}
                    className="
                        text-[#2D6A4F]
                        dark:text-emerald-400
                        shrink-0
                    "
                />

                <p
                    className="
                        text-slate-800
                        dark:text-slate-200
                        font-medium
                        leading-6
                    "
                >
                    AI-generated information is assistive only and is
                    not a medical diagnosis. Clinical decisions remain
                    with qualified healthcare professionals.
                </p>

            </div>


            {/* ERROR */}

            {error && (

                <div
                    className="
                        rounded-2xl
                        border
                        border-red-200
                        dark:border-red-900
                        bg-red-50
                        dark:bg-red-950/50
                        p-5
                        flex
                        gap-3
                        text-red-700
                        dark:text-red-300
                    "
                >

                    <AlertCircle
                        size={23}
                        className="shrink-0"
                    />

                    <p
                        className="
                            text-slate-800
                            dark:text-slate-200
                            font-medium
                        "
                    >
                        {error}
                    </p>

                </div>

            )}


            {/* ACTION */}

            <div
                className="
                    bg-white
                    dark:bg-slate-900
                    border
                    border-[#E8E0D5]
                    dark:border-slate-800
                    rounded-3xl
                    shadow-sm
                    p-6
                    sm:p-8
                "
            >

                <div
                    className="
                        flex
                        flex-col
                        sm:flex-row
                        sm:items-center
                        sm:justify-between
                        gap-5
                    "
                >

                    <div>

                        <h2
                            className="
                                text-xl
                                sm:text-2xl
                                font-bold
                                text-slate-900
                                dark:text-slate-100
                            "
                        >
                            Patient Health Overview
                        </h2>

                        <p
                            className="
                                mt-1
                                text-slate-600
                                dark:text-slate-400
                                font-medium
                            "
                        >
                            Generate a summary using the patient's
                            available records.
                        </p>

                        {generatedAt && (

                            <p
                                className="
                                    mt-2
                                    text-xs
                                    text-slate-500
                                    dark:text-slate-400
                                "
                            >
                                Last generated: {generatedAt}
                            </p>

                        )}

                    </div>


                    <div
                        className="
                            flex
                            flex-wrap
                            gap-3
                        "
                    >

                        <button
                            disabled={loading}
                            onClick={() =>
                                generateSummary(false)
                            }
                            className="
                                inline-flex
                                items-center
                                gap-2
                                px-5
                                py-3
                                rounded-xl
                                bg-[#2D6A4F]
                                hover:bg-[#1B4332]
                                dark:bg-emerald-600
                                dark:hover:bg-emerald-500
                                text-white
                                font-bold
                                disabled:opacity-50
                                transition
                            "
                        >

                            {loading ? (
                                <Loader2
                                    size={18}
                                    className="animate-spin"
                                />
                            ) : (
                                <Brain size={18} />
                            )}

                            {loading
                                ? "Generating..."
                                : "Generate"}

                        </button>


                        <button
                            disabled={loading}
                            onClick={() =>
                                generateSummary(true)
                            }
                            className="
                                inline-flex
                                items-center
                                gap-2
                                px-5
                                py-3
                                rounded-xl
                                bg-[#2563EB]
                                hover:bg-[#1D4ED8]
                                text-white
                                font-bold
                                disabled:opacity-50
                                transition
                            "
                        >

                            <RefreshCw size={18} />

                            Regenerate

                        </button>

                    </div>

                </div>


                {/* SUMMARY */}

                <div className="mt-7">

                    {summary ? (

                        <div
                            className="
                                rounded-2xl
                                border
                                border-[#E8E0D5]
                                dark:border-slate-700
                                bg-[#FAF7F2]
                                dark:bg-slate-800/80
                                p-6
                                sm:p-8
                                text-slate-900
                                dark:text-slate-100
                            "
                        >

                            <ReactMarkdown
                                components={{

                                    h1: ({ children }) => (
                                        <h1
                                            className="
                                                text-2xl
                                                font-bold
                                                mb-5
                                                text-slate-900
                                                dark:text-slate-100
                                            "
                                        >
                                            {children}
                                        </h1>
                                    ),

                                    h2: ({ children }) => (
                                        <h2
                                            className="
                                                text-xl
                                                font-bold
                                                mt-7
                                                mb-3
                                                text-[#1B4332]
                                                dark:text-emerald-400
                                            "
                                        >
                                            {children}
                                        </h2>
                                    ),

                                    h3: ({ children }) => (
                                        <h3
                                            className="
                                                text-lg
                                                font-bold
                                                mt-5
                                                mb-2
                                                text-slate-900
                                                dark:text-slate-100
                                            "
                                        >
                                            {children}
                                        </h3>
                                    ),

                                    p: ({ children }) => (
                                        <p
                                            className="
                                                leading-7
                                                mb-4
                                                font-medium
                                                text-slate-800
                                                dark:text-slate-200
                                            "
                                        >
                                            {children}
                                        </p>
                                    ),

                                    ul: ({ children }) => (
                                        <ul
                                            className="
                                                list-disc
                                                ml-6
                                                mb-4
                                                space-y-2
                                                text-slate-800
                                                dark:text-slate-200
                                            "
                                        >
                                            {children}
                                        </ul>
                                    ),

                                    li: ({ children }) => (
                                        <li>
                                            {children}
                                        </li>
                                    ),

                                    strong: ({ children }) => (
                                        <strong
                                            className="font-bold text-slate-900 dark:text-slate-100"
                                        >
                                            {children}
                                        </strong>
                                    ),

                                }}
                            >
                                {summary}
                            </ReactMarkdown>

                        </div>

                    ) : (

                        <div
                            className="
                                rounded-2xl
                                border
                                border-dashed
                                border-[#E8E0D5]
                                dark:border-slate-800
                                bg-[#FAF7F2]
                                dark:bg-slate-800/40
                                p-10
                                text-center
                            "
                        >

                            <Brain
                                size={44}
                                className="
                                    mx-auto
                                    text-[#2D6A4F]
                                    dark:text-emerald-400
                                "
                            />

                            <h3
                                className="
                                    mt-4
                                    text-xl
                                    font-bold
                                    text-slate-900
                                    dark:text-slate-100
                                "
                            >
                                No AI Summary Generated
                            </h3>

                            <p
                                className="
                                    mt-2
                                    text-slate-600
                                    dark:text-slate-400
                                    font-medium
                                "
                            >
                                Click Generate to create an
                                AI-assisted patient summary.
                            </p>

                        </div>

                    )}

                </div>

            </div>

        </div>
    );
}