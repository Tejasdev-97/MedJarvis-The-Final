import { useState, useRef, useEffect } from "react";
import {
    Mic,
    MicOff,
    Brain,
    Save,
    Loader2,
    CheckCircle2,
    AlertCircle,
    RotateCcw,
    ClipboardList,
    Calendar,
    ChevronDown,
    ChevronUp,
    X,
    Stethoscope,
    FileText,
    Clock,
    User,
} from "lucide-react";
import { useParams } from "react-router-dom";
import api from "../services/api";

// ─────────────────────────────────────────────────────────────
// Voice Recorder Component (Web Speech API — offline capable)
// ─────────────────────────────────────────────────────────────

function VoiceRecorder({ onTranscriptChange, transcript }) {

    const [isRecording, setIsRecording] = useState(false);
    const [supported, setSupported] = useState(true);
    const recognitionRef = useRef(null);

    useEffect(() => {
        const SpeechRecognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            setSupported(false);
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-IN";

        let finalTranscript = transcript || "";

        recognition.onresult = (event) => {
            let interim = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript + " ";
                } else {
                    interim += event.results[i][0].transcript;
                }
            }
            onTranscriptChange(finalTranscript + interim);
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            setIsRecording(false);
        };

        recognition.onend = () => {
            setIsRecording(false);
        };

        recognitionRef.current = recognition;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function toggleRecording() {
        if (!recognitionRef.current) return;

        if (isRecording) {
            recognitionRef.current.stop();
            setIsRecording(false);
        } else {
            recognitionRef.current.start();
            setIsRecording(true);
        }
    }

    if (!supported) {
        return (
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3">
                <MicOff size={16} />
                <span>
                    Voice recording requires Chrome, Edge, or Safari.
                    Type the consultation notes below.
                </span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-4">
            <button
                type="button"
                onClick={toggleRecording}
                className={`relative flex items-center gap-3 px-6 py-3 rounded-2xl font-bold text-white transition-all duration-200 ${
                    isRecording
                        ? "bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200 dark:shadow-red-900/30"
                        : "bg-[#2D6A4F] hover:bg-[#1B4332] dark:bg-emerald-600 dark:hover:bg-emerald-500"
                }`}
            >
                {isRecording ? (
                    <>
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full animate-ping" />
                        <MicOff size={20} />
                        Stop Recording
                    </>
                ) : (
                    <>
                        <Mic size={20} />
                        Start Recording
                    </>
                )}
            </button>

            {isRecording && (
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 font-medium">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    Listening...
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Confirmation Gate
// ─────────────────────────────────────────────────────────────

function ConfirmationGate({ extracted, rawTranscript, followUpDate, onFollowUpDateChange, onConfirm, onBack, saving }) {

    return (
        <div className="space-y-6">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex gap-3">
                <AlertCircle size={20} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-300 font-medium leading-5">
                    Review the AI-extracted information below before saving.
                    Nothing is recorded until you confirm. You may edit any field.
                </p>
            </div>

            <ExtractedFields extracted={extracted} followUpDate={followUpDate} onFollowUpDateChange={onFollowUpDateChange} />

            <div className="flex flex-col sm:flex-row gap-3">
                <button
                    type="button"
                    onClick={onBack}
                    disabled={saving}
                    className="flex-1 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 px-5 py-3 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-60"
                >
                    <span className="flex items-center justify-center gap-2">
                        <RotateCcw size={16} />
                        Back & Edit
                    </span>
                </button>
                <button
                    type="button"
                    onClick={onConfirm}
                    disabled={saving}
                    className="flex-1 bg-[#2D6A4F] hover:bg-[#1B4332] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold px-5 py-3 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-60"
                >
                    {saving ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <CheckCircle2 size={18} />
                            Confirm & Save Visit
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

function ExtractedFields({ extracted, followUpDate, onFollowUpDateChange }) {

    const [expanded, setExpanded] = useState({ notes: true, symptoms: true });

    function toggle(key) {
        setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
    }

    return (
        <div className="space-y-4">
            {/* Chief Complaint */}
            <div className="bg-white dark:bg-slate-900 border border-[#E8E0D5] dark:border-slate-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                    <Stethoscope size={16} className="text-[#2D6A4F] dark:text-emerald-400" />
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm uppercase tracking-wide">
                        Chief Complaint
                    </h3>
                </div>
                <p className="text-slate-800 dark:text-slate-200 font-medium">
                    {extracted.chiefComplaint || <span className="text-slate-400 italic">Not identified</span>}
                </p>
            </div>

            {/* Symptoms */}
            <div className="bg-white dark:bg-slate-900 border border-[#E8E0D5] dark:border-slate-800 rounded-2xl p-5">
                <button
                    type="button"
                    onClick={() => toggle("symptoms")}
                    className="flex items-center justify-between w-full"
                >
                    <div className="flex items-center gap-2">
                        <ClipboardList size={16} className="text-[#2D6A4F] dark:text-emerald-400" />
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm uppercase tracking-wide">
                            Symptoms ({extracted.symptoms?.length || 0})
                        </h3>
                    </div>
                    {expanded.symptoms ? (
                        <ChevronUp size={16} className="text-slate-500" />
                    ) : (
                        <ChevronDown size={16} className="text-slate-500" />
                    )}
                </button>
                {expanded.symptoms && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {extracted.symptoms?.length > 0 ? (
                            extracted.symptoms.map((s, i) => (
                                <span
                                    key={i}
                                    className="px-3 py-1 bg-[#D8F3DC] dark:bg-emerald-950 text-[#1B4332] dark:text-emerald-300 rounded-full text-sm font-medium"
                                >
                                    {s}
                                </span>
                            ))
                        ) : (
                            <span className="text-slate-400 italic text-sm">No symptoms identified</span>
                        )}
                    </div>
                )}
            </div>

            {/* Clinical Notes */}
            <div className="bg-white dark:bg-slate-900 border border-[#E8E0D5] dark:border-slate-800 rounded-2xl p-5">
                <button
                    type="button"
                    onClick={() => toggle("notes")}
                    className="flex items-center justify-between w-full"
                >
                    <div className="flex items-center gap-2">
                        <FileText size={16} className="text-[#2D6A4F] dark:text-emerald-400" />
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm uppercase tracking-wide">
                            Clinical Notes
                        </h3>
                    </div>
                    {expanded.notes ? (
                        <ChevronUp size={16} className="text-slate-500" />
                    ) : (
                        <ChevronDown size={16} className="text-slate-500" />
                    )}
                </button>
                {expanded.notes && (
                    <p className="mt-3 text-slate-800 dark:text-slate-200 font-medium leading-6 text-sm">
                        {extracted.clinicalNotes || <span className="text-slate-400 italic">No clinical notes found</span>}
                    </p>
                )}
            </div>

            {/* Follow-up */}
            <div className="bg-white dark:bg-slate-900 border border-[#E8E0D5] dark:border-slate-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                    <Calendar size={16} className="text-[#2D6A4F] dark:text-emerald-400" />
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm uppercase tracking-wide">
                        Follow-Up Date
                    </h3>
                </div>
                <input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => onFollowUpDateChange(e.target.value)}
                    className="border border-[#E8E0D5] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                />
                {extracted.followUpDate && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        AI suggested: {new Date(extracted.followUpDate).toLocaleDateString("en-IN")}
                    </p>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Past Visit Card
// ─────────────────────────────────────────────────────────────

function VisitCard({ visit }) {
    const [expanded, setExpanded] = useState(false);

    function formatDate(val) {
        if (!val) return "—";
        return new Date(val).toLocaleString("en-IN", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit",
        });
    }

    return (
        <div className="bg-white dark:bg-slate-900 border border-[#E8E0D5] dark:border-slate-800 rounded-2xl overflow-hidden hover:shadow-md transition-all duration-200">
            <button
                onClick={() => setExpanded((v) => !v)}
                className="w-full flex items-start justify-between p-5 text-left"
            >
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#D8F3DC] dark:bg-emerald-950 flex items-center justify-center flex-shrink-0">
                        <Stethoscope size={18} className="text-[#2D6A4F] dark:text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-slate-100">
                            {visit.chiefComplaint || "Doctor Visit"}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <Clock size={12} />
                                {formatDate(visit.visitDate || visit.createdAt)}
                            </span>
                            {visit.doctor?.displayName && (
                                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                    <User size={12} />
                                    {visit.doctor.displayName}
                                </span>
                            )}
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                visit.source === "VOICE"
                                    ? "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300"
                                    : "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                            }`}>
                                {visit.source || "MANUAL"}
                            </span>
                        </div>
                    </div>
                </div>
                {expanded ? (
                    <ChevronUp size={18} className="text-slate-400 flex-shrink-0 mt-1" />
                ) : (
                    <ChevronDown size={18} className="text-slate-400 flex-shrink-0 mt-1" />
                )}
            </button>

            {expanded && (
                <div className="px-5 pb-5 border-t border-[#E8E0D5] dark:border-slate-800 pt-4 space-y-4">
                    {visit.symptoms?.length > 0 && (
                        <div>
                            <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2">Symptoms</p>
                            <div className="flex flex-wrap gap-2">
                                {visit.symptoms.map((s, i) => (
                                    <span key={i} className="px-2.5 py-1 bg-[#D8F3DC] dark:bg-emerald-950 text-[#1B4332] dark:text-emerald-300 rounded-full text-xs font-medium">
                                        {s}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    {visit.clinicalNotes && (
                        <div>
                            <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Clinical Notes</p>
                            <p className="text-sm text-slate-800 dark:text-slate-200 leading-6">{visit.clinicalNotes}</p>
                        </div>
                    )}
                    {visit.followUpDate && (
                        <div>
                            <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Follow-Up</p>
                            <p className="text-sm text-slate-800 dark:text-slate-200">
                                {new Date(visit.followUpDate).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────

export default function DoctorVisitPage() {

    const { patientId: urlPatientId } = useParams();

    const profile = JSON.parse(localStorage.getItem("profile") || "{}");
    const role = profile?.role || "";

    // For patients, resolve their own patient ID
    const patientId =
        urlPatientId ||
        (typeof profile.patient === "object" ? profile.patient?._id : profile.patient) ||
        null;

    // ── State ──
    const [step, setStep] = useState("form"); // "form" | "confirm" | "success"
    const [transcript, setTranscript] = useState("");
    const [extracting, setExtracting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [extracted, setExtracted] = useState(null);
    const [followUpDate, setFollowUpDate] = useState("");
    const [error, setError] = useState("");

    // Past visits
    const [visits, setVisits] = useState([]);
    const [loadingVisits, setLoadingVisits] = useState(true);

    const isDoctor =
        role === "Doctor" ||
        role === "Health Worker" ||
        role === "Hospital Manager" ||
        role === "Super Admin";

    // ── Load past visits ──
    useEffect(() => {
        if (!patientId) {
            setLoadingVisits(false);
            return;
        }
        (async () => {
            try {
                const res = await api.get(`/visits/${patientId}`);
                setVisits(res.data?.data || []);
            } catch {
                setVisits([]);
            } finally {
                setLoadingVisits(false);
            }
        })();
    }, [patientId]);

    // ── Extract ──
    async function extractFromTranscript() {
        if (!transcript.trim()) {
            setError("Please record or type a consultation transcript first.");
            return;
        }
        setError("");
        setExtracting(true);

        try {
            const apiKey = localStorage.getItem("geminiKey");

            if (!apiKey) {
                // Manual mode — skip AI extraction, go directly to confirm with empty fields
                setExtracted({
                    chiefComplaint: "",
                    symptoms: [],
                    clinicalNotes: transcript,
                    followUpDate: null,
                });
                setStep("confirm");
                return;
            }

            const res = await api.post("/visits/extract", {
                transcript,
                apiKey,
            });

            if (!res.data?.success) {
                throw new Error(res.data?.message || "Extraction failed.");
            }

            const data = res.data.data;

            setExtracted(data);

            if (data.followUpDate) {
                const d = new Date(data.followUpDate);
                if (!isNaN(d)) {
                    setFollowUpDate(d.toISOString().split("T")[0]);
                }
            }

            setStep("confirm");
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Extraction failed.");
        } finally {
            setExtracting(false);
        }
    }

    // ── Save confirmed visit ──
    async function saveVisit() {
        if (!patientId) {
            setError("No patient is linked to this session.");
            return;
        }

        setSaving(true);
        setError("");

        try {
            await api.post("/visits", {
                patientId,
                rawTranscript: transcript,
                chiefComplaint: extracted?.chiefComplaint || "",
                symptoms: extracted?.symptoms || [],
                clinicalNotes: extracted?.clinicalNotes || transcript,
                followUpDate: followUpDate || null,
                source: transcript ? "VOICE" : "MANUAL",
            });

            // Reload visits
            const res = await api.get(`/visits/${patientId}`);
            setVisits(res.data?.data || []);

            setStep("success");
        } catch (err) {
            setError(err.response?.data?.message || "Failed to save visit.");
        } finally {
            setSaving(false);
        }
    }

    function reset() {
        setStep("form");
        setTranscript("");
        setExtracted(null);
        setFollowUpDate("");
        setError("");
    }

    // ─────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────

    return (
        <div className="max-w-5xl mx-auto space-y-8">

            {/* ── Header ── */}
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#D8F3DC] dark:bg-emerald-950 text-[#1B4332] dark:text-emerald-300 text-sm font-bold mb-3">
                    <Stethoscope size={16} />
                    Doctor Visit Memory
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold text-[#1B4332] dark:text-emerald-400">
                    Visit Notes
                </h1>
                <p className="mt-2 text-slate-700 dark:text-slate-300 font-medium text-base sm:text-lg">
                    Record consultation notes by voice or text. AI extracts structured data before saving.
                </p>
            </div>

            {/* ── Error ── */}
            {error && (
                <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 p-4 flex gap-3 text-red-700 dark:text-red-300">
                    <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                    <p className="font-medium">{error}</p>
                    <button onClick={() => setError("")} className="ml-auto">
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* ── New Visit Form ── */}
            {isDoctor && (
                <div className="bg-white dark:bg-slate-900 border border-[#E8E0D5] dark:border-slate-800 rounded-3xl shadow-sm p-6 sm:p-8">

                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-11 h-11 rounded-xl bg-[#D8F3DC] dark:bg-emerald-950 flex items-center justify-center">
                            <Mic size={20} className="text-[#2D6A4F] dark:text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                                New Consultation Note
                            </h2>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Use voice or type the consultation transcript
                            </p>
                        </div>
                    </div>

                    {step === "form" && (
                        <div className="space-y-5">
                            <VoiceRecorder
                                transcript={transcript}
                                onTranscriptChange={setTranscript}
                            />

                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                    Consultation Transcript
                                </label>
                                <textarea
                                    rows={7}
                                    value={transcript}
                                    onChange={(e) => setTranscript(e.target.value)}
                                    placeholder="Speak into the microphone or type the consultation notes here..."
                                    className="w-full border border-[#E8E0D5] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F] text-sm leading-6 resize-none"
                                />
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    {transcript.length} characters
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={extractFromTranscript}
                                    disabled={extracting || !transcript.trim()}
                                    className="flex items-center gap-2 px-6 py-3 bg-[#2D6A4F] hover:bg-[#1B4332] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold rounded-xl transition disabled:opacity-50"
                                >
                                    {extracting ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            Extracting...
                                        </>
                                    ) : (
                                        <>
                                            <Brain size={18} />
                                            Extract & Review
                                        </>
                                    )}
                                </button>

                                {transcript && (
                                    <button
                                        type="button"
                                        onClick={reset}
                                        className="flex items-center gap-2 px-5 py-3 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                                    >
                                        <RotateCcw size={16} />
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {step === "confirm" && extracted && (
                        <ConfirmationGate
                            extracted={extracted}
                            rawTranscript={transcript}
                            followUpDate={followUpDate}
                            onFollowUpDateChange={setFollowUpDate}
                            onConfirm={saveVisit}
                            onBack={() => setStep("form")}
                            saving={saving}
                        />
                    )}

                    {step === "success" && (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#D8F3DC] dark:bg-emerald-950 flex items-center justify-center mb-4">
                                <CheckCircle2 size={32} className="text-[#2D6A4F] dark:text-emerald-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                                Visit Saved!
                            </h3>
                            <p className="text-slate-600 dark:text-slate-400 mb-6">
                                The consultation note has been recorded and added to the patient's medical timeline.
                            </p>
                            <button
                                onClick={reset}
                                className="px-6 py-3 bg-[#2D6A4F] hover:bg-[#1B4332] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold rounded-xl transition"
                            >
                                Record Another Visit
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── Past Visits ── */}
            <div className="bg-white dark:bg-slate-900 border border-[#E8E0D5] dark:border-slate-800 rounded-3xl shadow-sm p-6 sm:p-8">

                <div className="flex items-center gap-3 mb-6">
                    <div className="w-11 h-11 rounded-xl bg-[#D8F3DC] dark:bg-emerald-950 flex items-center justify-center">
                        <ClipboardList size={20} className="text-[#2D6A4F] dark:text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                            Visit History
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            {loadingVisits
                                ? "Loading..."
                                : `${visits.length} recorded visit${visits.length !== 1 ? "s" : ""}`}
                        </p>
                    </div>
                </div>

                {loadingVisits ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 size={32} className="animate-spin text-[#2D6A4F] dark:text-emerald-400" />
                    </div>
                ) : visits.length === 0 ? (
                    <div className="text-center py-10">
                        <Stethoscope size={44} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                        <p className="text-slate-500 dark:text-slate-400 font-medium">No visits recorded yet.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {visits.map((visit) => (
                            <VisitCard key={visit._id} visit={visit} />
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
}
