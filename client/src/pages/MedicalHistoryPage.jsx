import { useEffect, useMemo, useState } from "react";
import {
    Activity,
    AlertTriangle,
    CalendarDays,
    CheckCircle2,
    ClipboardList,
    FileText,
    HeartPulse,
    Loader2,
    Pill,
    Stethoscope,
    Ambulance,
    Filter,
    X,
} from "lucide-react";

import api from "../services/api";


const EVENT_CONFIG = {

    Diagnosis: {
        icon: Stethoscope,
        dotBg: "bg-blue-100 dark:bg-blue-950",
        iconColor: "text-blue-600 dark:text-blue-400",
        badge: "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    },

    Prescription: {
        icon: Pill,
        dotBg: "bg-amber-100 dark:bg-amber-950",
        iconColor: "text-amber-600 dark:text-amber-400",
        badge: "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    },

    Emergency: {
        icon: Ambulance,
        dotBg: "bg-red-100 dark:bg-red-950",
        iconColor: "text-red-600 dark:text-red-400",
        badge: "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
    },

    Checkup: {
        icon: HeartPulse,
        dotBg: "bg-green-100 dark:bg-green-950",
        iconColor: "text-green-600 dark:text-green-400",
        badge: "bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
    },

    Admission: {
        icon: ClipboardList,
        dotBg: "bg-purple-100 dark:bg-purple-950",
        iconColor: "text-purple-600 dark:text-purple-400",
        badge: "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    },

    Discharge: {
        icon: CheckCircle2,
        dotBg: "bg-emerald-100 dark:bg-emerald-950",
        iconColor: "text-emerald-600 dark:text-emerald-400",
        badge: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    },

    Other: {
        icon: FileText,
        dotBg: "bg-slate-100 dark:bg-slate-800",
        iconColor: "text-slate-600 dark:text-slate-400",
        badge: "bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    },

};

const ALL_FILTER = "All";
const FILTER_OPTIONS = [
    ALL_FILTER,
    "Prescription",
    "Checkup",
    "Emergency",
    "Diagnosis",
    "Admission",
    "Discharge",
    "Other",
];

const SOURCE_LABEL = {
    timeline: "Timeline",
    prescription: "Prescription",
    visit: "Visit",
    emergency: "Emergency",
};

export default function MedicalHistoryPage() {

    const [timeline, setTimeline] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [activeFilter, setActiveFilter] = useState(ALL_FILTER);

    const profile = JSON.parse(
        localStorage.getItem("profile") || "{}"
    );

    const patientId = useMemo(() => {
        if (
            profile?.patient &&
            typeof profile.patient === "object"
        ) {
            return profile.patient?._id;
        }
        return profile?.patient || null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    useEffect(() => {

        let mounted = true;

        async function loadTimeline() {

            if (!patientId) {
                if (mounted) {
                    setError(
                        "No patient profile is linked to the current account."
                    );
                    setLoading(false);
                }
                return;
            }

            try {
                setLoading(true);
                setError("");

                // Use the unified full history endpoint
                const response = await api.get(
                    `/timeline/full/${patientId}`
                );

                if (!mounted) return;

                setTimeline(response.data?.data || []);

            } catch (err) {

                console.error("Medical history error:", err);

                // Fallback to the original timeline endpoint
                try {
                    const fallback = await api.get(`/timeline/${patientId}`);
                    if (mounted) {
                        const raw = fallback.data?.data || [];
                        setTimeline(
                            raw.map((e) => ({
                                _id: e._id,
                                _source: "timeline",
                                eventType: e.eventType || "Other",
                                title: e.title,
                                description: e.description,
                                date: e.createdAt,
                                createdBy: e.createdBy,
                                raw: e,
                            }))
                        );
                    }
                } catch {
                    if (mounted) {
                        setTimeline([]);
                        setError(
                            err.response?.data?.message ||
                            "Unable to load medical history."
                        );
                    }
                }

            } finally {
                if (mounted) setLoading(false);
            }

        }

        loadTimeline();

        return () => { mounted = false; };

    }, [patientId]);


    function formatDate(value) {
        if (!value) return "Date unavailable";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "Date unavailable";
        return date.toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    const filteredTimeline = useMemo(() => {
        if (activeFilter === ALL_FILTER) return timeline;
        return timeline.filter((e) => e.eventType === activeFilter);
    }, [timeline, activeFilter]);

    const counts = useMemo(() => {
        const c = { All: timeline.length };
        for (const e of timeline) {
            c[e.eventType] = (c[e.eventType] || 0) + 1;
        }
        return c;
    }, [timeline]);


    if (loading) {
        return (
            <div className="min-h-[55vh] flex items-center justify-center">
                <div className="text-center">
                    <Loader2
                        size={44}
                        className="mx-auto animate-spin text-[#2D6A4F] dark:text-emerald-400"
                    />
                    <p className="mt-4 text-slate-900 dark:text-slate-100 font-bold text-lg">
                        Loading Medical History...
                    </p>
                </div>
            </div>
        );
    }


    return (

        <div className="max-w-6xl mx-auto space-y-7">

            {/* =====================================================
                HEADER
            ====================================================== */}

            <div>

                <div className="inline-flex items-center gap-2 bg-[#D8F3DC] dark:bg-emerald-950 text-[#1B4332] dark:text-emerald-300 px-3 py-1.5 rounded-full text-sm font-bold mb-3">
                    <Activity size={16} />
                    Complete Patient Timeline
                </div>

                <h1 className="text-3xl sm:text-4xl font-bold text-[#1B4332] dark:text-emerald-400">
                    Medical History
                </h1>

                <p className="mt-2 text-slate-700 dark:text-slate-300 font-medium text-base sm:text-lg">
                    All prescriptions, visits, emergency events and clinical events — in one place.
                </p>

            </div>


            {/* =====================================================
                ERROR
            ====================================================== */}

            {error && (

                <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 p-5">

                    <div className="flex gap-3 items-start text-red-700 dark:text-red-300">

                        <AlertTriangle size={23} className="mt-0.5 shrink-0" />

                        <div>
                            <h2 className="font-bold text-lg">
                                Medical History Unavailable
                            </h2>
                            <p className="mt-1 text-slate-800 dark:text-slate-200 font-medium">
                                {error}
                            </p>
                        </div>

                    </div>

                </div>

            )}


            {/* =====================================================
                FILTER TABS
            ====================================================== */}

            {!error && timeline.length > 0 && (

                <div className="bg-white dark:bg-slate-900 border border-[#E8E0D5] dark:border-slate-800 rounded-2xl p-4">

                    <div className="flex items-center gap-2 mb-3">
                        <Filter size={16} className="text-[#2D6A4F] dark:text-emerald-400" />
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Filter by type</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {FILTER_OPTIONS.map((opt) => {
                            const count = counts[opt] || 0;
                            if (opt !== ALL_FILTER && count === 0) return null;

                            const isActive = activeFilter === opt;
                            return (
                                <button
                                    key={opt}
                                    onClick={() => setActiveFilter(opt)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold transition ${
                                        isActive
                                            ? "bg-[#2D6A4F] dark:bg-emerald-600 text-white"
                                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                                    }`}
                                >
                                    {opt}
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                        isActive
                                            ? "bg-white/20 text-white"
                                            : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                                    }`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}

                        {activeFilter !== ALL_FILTER && (
                            <button
                                onClick={() => setActiveFilter(ALL_FILTER)}
                                className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 ml-2"
                            >
                                <X size={12} />
                                Clear filter
                            </button>
                        )}
                    </div>

                </div>

            )}


            {/* =====================================================
                EMPTY STATE
            ====================================================== */}

            {!error && timeline.length === 0 && (

                <div className="bg-white dark:bg-slate-900 border border-[#E8E0D5] dark:border-slate-800 rounded-3xl shadow-sm p-10 text-center">

                    <div className="w-16 h-16 mx-auto rounded-2xl bg-[#D8F3DC] dark:bg-emerald-950 flex items-center justify-center">
                        <ClipboardList size={30} className="text-[#2D6A4F] dark:text-emerald-400" />
                    </div>

                    <h2 className="mt-5 text-2xl font-bold text-slate-900 dark:text-slate-100">
                        No Medical Events Yet
                    </h2>

                    <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-6">
                        Medical diagnoses, prescriptions, doctor visits, emergency events and other recorded events will appear here.
                    </p>

                </div>

            )}


            {/* =====================================================
                TIMELINE
            ====================================================== */}

            {filteredTimeline.length > 0 && (

                <div className="bg-white dark:bg-slate-900 border border-[#E8E0D5] dark:border-slate-800 rounded-3xl shadow-sm p-5 sm:p-7">

                    <div className="flex items-center gap-3 mb-7">

                        <div className="w-11 h-11 rounded-xl bg-[#D8F3DC] dark:bg-emerald-950 flex items-center justify-center">
                            <CalendarDays size={23} className="text-[#2D6A4F] dark:text-emerald-400" />
                        </div>

                        <div>
                            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                                Health Timeline
                            </h2>
                            <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">
                                {filteredTimeline.length} event{filteredTimeline.length === 1 ? "" : "s"}
                                {activeFilter !== ALL_FILTER && ` · ${activeFilter}`}
                            </p>
                        </div>

                    </div>


                    <div className="relative">

                        <div className="absolute left-[21px] top-3 bottom-3 w-px bg-[#D8F3DC] dark:bg-emerald-900" />

                        <div className="space-y-7">

                            {filteredTimeline.map((event, index) => {

                                const config =
                                    EVENT_CONFIG[event.eventType] ||
                                    EVENT_CONFIG.Other;

                                const Icon = config.icon;

                                return (

                                    <div
                                        key={event._id?.toString() || `${event.date}-${index}`}
                                        className="relative pl-14"
                                    >

                                        {/* Timeline dot */}

                                        <div className={`absolute left-0 top-0 w-11 h-11 rounded-xl border border-[#D8F3DC] dark:border-slate-700 flex items-center justify-center z-10 shadow-sm ${config.dotBg}`}>
                                            <Icon size={20} className={config.iconColor} />
                                        </div>


                                        {/* Event card */}

                                        <div className="bg-[#FAF7F2] dark:bg-slate-800/80 border border-[#E8E0D5] dark:border-slate-700 rounded-2xl p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">

                                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">

                                                <div>

                                                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                                        {event.title}
                                                    </h3>

                                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 font-medium">
                                                        {formatDate(event.date)}
                                                    </p>

                                                </div>

                                                <div className="flex items-center gap-2 flex-wrap">

                                                    <span className={`inline-flex items-center self-start px-3 py-1.5 rounded-full border text-xs font-bold ${config.badge}`}>
                                                        {event.eventType || "Other"}
                                                    </span>

                                                    {event._source && (
                                                        <span className="inline-flex items-center self-start px-2 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                            {SOURCE_LABEL[event._source] || event._source}
                                                        </span>
                                                    )}

                                                </div>

                                            </div>


                                            <p className="mt-4 text-slate-800 dark:text-slate-200 leading-6 font-medium">
                                                {event.description}
                                            </p>


                                            {event.createdBy && (
                                                <div className="mt-4 pt-3 border-t border-[#E8E0D5] dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400 font-medium">
                                                    Recorded by{" "}
                                                    <span className="text-slate-900 dark:text-slate-200 font-bold">
                                                        {event.createdBy?.displayName || "Healthcare Staff"}
                                                    </span>
                                                </div>
                                            )}

                                        </div>

                                    </div>

                                );

                            })}

                        </div>

                    </div>

                </div>

            )}

            {/* ── No results for filter ── */}
            {!error && timeline.length > 0 && filteredTimeline.length === 0 && (
                <div className="text-center py-10 text-slate-500 dark:text-slate-400">
                    <FileText size={36} className="mx-auto mb-3 opacity-40" />
                    <p className="font-medium">No events match this filter.</p>
                    <button
                        onClick={() => setActiveFilter(ALL_FILTER)}
                        className="mt-3 text-[#2D6A4F] dark:text-emerald-400 font-bold text-sm hover:underline"
                    >
                        Show all events
                    </button>
                </div>
            )}

        </div>
    );
}