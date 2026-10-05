import { useEffect, useState, useCallback, useMemo } from "react";
import {
    Users,
    Search,
    RefreshCw,
    Eye,
    UserPlus,
    ShieldCheck,
    ShieldAlert,
    X,
    ChevronDown,
    ChevronRight,
    CheckCircle,
    AlertTriangle,
    Lock,
    QrCode,
    Edit,
    Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import {
    getMyPatients,
    requestAccess,
    useConsentPin,
} from "../services/accessGrantService";

// ── Scope options for request form ─────────────────────────────
const ALL_SCOPES = [
    { value: "PROFILE", label: "Profile & Demographics" },
    { value: "MEDICAL_HISTORY", label: "Medical History" },
    { value: "PRESCRIPTIONS", label: "Prescriptions" },
    { value: "VITALS", label: "Vital Signs" },
    { value: "VISIT_NOTES", label: "Doctor Visit Notes" },
    { value: "MONITORING", label: "Health Monitoring" },
    { value: "ALLERGIES", label: "Allergies" },
    { value: "EXTERNAL_RECORDS", label: "External Records" },
    { value: "AI_SUMMARY", label: "AI Health Summary" },
];

// ── Helpers ─────────────────────────────────────────────────────
function initials(p) {
    const f = p?.firstName?.[0] || "";
    const l = p?.lastName?.[0] || "";
    return (f + l).toUpperCase() || "?";
}

function patientAge(dob) {
    if (!dob) return "—";
    const diff = Date.now() - new Date(dob).getTime();
    return `${Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))} yrs`;
}

// ── Request Access Modal ────────────────────────────────────────
function RequestAccessModal({ patientId, patientName, onClose, onSuccess }) {
    const [mode, setMode] = useState("request"); // request | pin
    const [form, setForm] = useState({
        purpose: "",
        requestMessage: "",
        scopes: ["PROFILE", "MEDICAL_HISTORY", "PRESCRIPTIONS"],
        durationHours: 72,
        pin: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const toggleScope = (v) =>
        setForm((f) => ({
            ...f,
            scopes: f.scopes.includes(v)
                ? f.scopes.filter((s) => s !== v)
                : [...f.scopes, v],
        }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!form.purpose.trim()) {
            setError("Please state the purpose of access.");
            return;
        }
        if (form.scopes.length === 0) {
            setError("Select at least one data category.");
            return;
        }

        try {
            setLoading(true);

            if (mode === "pin") {
                if (!form.pin.trim()) {
                    setError("Please enter the consent PIN.");
                    setLoading(false);
                    return;
                }
                await useConsentPin({
                    patientId,
                    pin: form.pin,
                    purpose: form.purpose,
                    scopes: form.scopes,
                    durationHours: 4,
                });
                onSuccess("Consent PIN verified. Access granted.");
            } else {
                await requestAccess({
                    patientId,
                    purpose: form.purpose,
                    requestMessage: form.requestMessage,
                    scopes: form.scopes,
                    durationHours: form.durationHours || null,
                });
                onSuccess("Access request sent. Patient must approve.");
            }

            onClose();
        } catch (err) {
            setError(err.response?.data?.message || "Request failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
                {/* Modal header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Request Patient Access</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{patientName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        <X size={18} className="text-slate-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-5 space-y-4">
                    {/* Mode toggle */}
                    <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setMode("request")}
                            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${mode === "request" ? "bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 dark:text-slate-400"}`}
                        >
                            Digital Request
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode("pin")}
                            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${mode === "pin" ? "bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 dark:text-slate-400"}`}
                        >
                            Consent PIN
                        </button>
                    </div>

                    {/* Purpose */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                            Purpose of Access *
                        </label>
                        <input
                            type="text"
                            value={form.purpose}
                            onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                            placeholder="e.g. Follow-up consultation"
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                    </div>

                    {/* PIN field */}
                    {mode === "pin" && (
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                                Patient's Consent PIN *
                            </label>
                            <input
                                type="password"
                                maxLength={6}
                                value={form.pin}
                                onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value }))}
                                placeholder="Enter 6-digit PIN"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                        </div>
                    )}

                    {/* Message (digital only) */}
                    {mode === "request" && (
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                                Message to patient (optional)
                            </label>
                            <textarea
                                value={form.requestMessage}
                                onChange={(e) => setForm((f) => ({ ...f, requestMessage: e.target.value }))}
                                rows={2}
                                placeholder="Add a note to help the patient understand your request..."
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                        </div>
                    )}

                    {/* Scopes */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wide">
                            Data Categories Requested *
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {ALL_SCOPES.map(({ value, label }) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => toggleScope(value)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all text-left ${form.scopes.includes(value) ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300" : "bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300"}`}
                                >
                                    <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0 ${form.scopes.includes(value) ? "bg-indigo-600 border-indigo-600" : "border-slate-300 dark:border-slate-500"}`}>
                                        {form.scopes.includes(value) && (
                                            <CheckCircle size={10} className="text-white" strokeWidth={3} />
                                        )}
                                    </div>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Duration (digital only) */}
                    {mode === "request" && (
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                                Duration
                            </label>
                            <select
                                value={form.durationHours}
                                onChange={(e) => setForm((f) => ({ ...f, durationHours: parseInt(e.target.value) }))}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            >
                                <option value={4}>4 Hours</option>
                                <option value={24}>24 Hours</option>
                                <option value={72}>3 Days</option>
                                <option value={168}>1 Week</option>
                                <option value={720}>1 Month</option>
                                <option value={0}>Indefinite</option>
                            </select>
                        </div>
                    )}

                    {error && (
                        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-2.5">
                            <AlertTriangle size={14} />
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-60"
                    >
                        {loading ? <RefreshCw size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                        {mode === "pin" ? "Verify PIN & Get Access" : "Send Access Request"}
                    </button>
                </form>
            </div>
        </div>
    );
}

// ── Patient Card ────────────────────────────────────────────────
function PatientCard({ patient, onView, onHealthCard, onEdit, onDelete, onRequest, isConsented, role }) {
    const canEditDelete = role === "Hospital Manager" || role === "Health Worker" || role === "Super Admin";

    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-700 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {initials(patient)}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {patient.firstName} {patient.lastName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {patient.medJarvisId} · {patientAge(patient.dateOfBirth)} · {patient.gender || "—"}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
                {isConsented ? (
                    <>
                        <button
                            onClick={() => onView(patient._id)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-semibold transition-all"
                        >
                            <Eye size={13} />
                            View
                        </button>

                        <button
                            onClick={() => onHealthCard(patient._id)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-semibold transition-all"
                        >
                            <QrCode size={13} />
                            Health Card
                        </button>

                        {canEditDelete && (
                            <>
                                <button
                                    onClick={() => onEdit(patient)}
                                    title="Edit Patient"
                                    className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-xl transition-all"
                                >
                                    <Edit size={14} />
                                </button>
                                <button
                                    onClick={() => onDelete(patient)}
                                    title="Delete Patient"
                                    className="p-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 text-red-600 dark:text-red-400 rounded-xl transition-all"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </>
                        )}
                    </>
                ) : (
                    <button
                        onClick={() => onRequest(patient)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-600 hover:border-indigo-200 dark:hover:border-indigo-700 transition-all"
                    >
                        <Lock size={13} />
                        Request Access
                    </button>
                )}
            </div>
        </div>
    );
}

// ── Find Patient Section ────────────────────────────────────────
function FindPatientSection({ onRequest }) {
    const [searchId, setSearchId] = useState("");
    const [result, setResult] = useState(null);
    const [searching, setSearching] = useState(false);
    const [notFound, setNotFound] = useState(false);

    const search = async () => {
        const id = searchId.trim();
        if (!id) return;
        try {
            setSearching(true);
            setNotFound(false);
            setResult(null);
            const res = await api.get(`/patients/scan/${encodeURIComponent(id)}`);
            setResult(res.data.data);
        } catch {
            setNotFound(true);
        } finally {
            setSearching(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
            <div className="flex items-center gap-2">
                <Search size={15} className="text-slate-400" />
                <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Find Patient by MedJarvis ID</h3>
            </div>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={searchId}
                    onChange={(e) => setSearchId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && search()}
                    placeholder="MJ-KA-UK-2024-XXXXXX"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button
                    onClick={search}
                    disabled={searching || !searchId.trim()}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-60 flex items-center gap-1.5"
                >
                    {searching ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
                    Search
                </button>
            </div>
            {notFound && (
                <p className="text-sm text-red-500 dark:text-red-400">No patient found with that ID.</p>
            )}
            {result && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {initials(result)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{result.firstName} {result.lastName}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{result.medJarvisId}</p>
                    </div>
                    <button
                        onClick={() => onRequest(result)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-all"
                    >
                        <UserPlus size={13} />
                        Request Access
                    </button>
                </div>
            )}
        </div>
    );
}

// ── Main Page ──────────────────────────────────────────────────
export default function MyPatientsPage() {
    const navigate = useNavigate();
    const [myPatients, setMyPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [requestTarget, setRequestTarget] = useState(null);
    const [toast, setToast] = useState(null);

    const showToast = (msg, type = "success") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await getMyPatients();
            setMyPatients(res.data.data || []);
        } catch {
            showToast("Failed to load patients.", "error");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, []);

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q) return myPatients;
        return myPatients.filter((p) =>
            `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
            (p.medJarvisId || "").toLowerCase().includes(q)
        );
    }, [myPatients, search]);

    return (
        <div className="max-w-2xl mx-auto space-y-5 pb-10">

            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-2xl shadow-2xl text-sm font-medium flex items-center gap-2 ${toast.type === "error" ? "bg-red-600 text-white" : "bg-emerald-600 text-white"}`}>
                    {toast.type === "error" ? <AlertTriangle size={15} /> : <CheckCircle size={15} />}
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <Users size={22} className="text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">My Patients</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {myPatients.length} patient{myPatients.length !== 1 ? "s" : ""} in care history
                    </p>
                </div>
                <button
                    onClick={load}
                    className="ml-auto p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors"
                >
                    <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            {/* Find patient */}
            <FindPatientSection
                onRequest={(patient) => setRequestTarget(patient)}
            />

            {/* Search */}
            <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search patients by name or ID..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
            </div>

            {/* Patient list */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <RefreshCw size={24} className="animate-spin text-indigo-500" />
                </div>
            ) : filtered.length === 0 && !search ? (
                <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <Users size={44} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                    <p className="text-slate-600 dark:text-slate-400 font-medium">No patient records found in your care history.</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        Use the search above to find a patient by ID and request access.
                    </p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                    <p className="text-sm">No matching patients.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map((p) => (
                        <PatientCard
                            key={p._id}
                            patient={p}
                            isConsented={p.isConsented ?? p.hasActiveAccess ?? false}
                            role={JSON.parse(localStorage.getItem("profile") || "{}").role || "Doctor"}
                            onView={(id) => navigate(`/patient-summary/${id}`)}
                            onHealthCard={(id) => navigate(`/health-card/${id}`)}
                            onEdit={(patient) => navigate(`/register-patient`, { state: { editPatient: patient } })}
                            onDelete={async (patient) => {
                                if (window.confirm(`Are you sure you want to deactivate/delete patient ${patient.firstName} ${patient.lastName}?`)) {
                                    try {
                                        await api.delete(`/patients/${patient._id}`);
                                        showToast("Patient deactivated.");
                                        load();
                                    } catch (err) {
                                        showToast(err.response?.data?.message || "Failed to delete patient.", "error");
                                    }
                                }
                            }}
                            onRequest={setRequestTarget}
                        />
                    ))}
                </div>
            )}

            {/* Request modal */}
            {requestTarget && (
                <RequestAccessModal
                    patientId={requestTarget._id}
                    patientName={`${requestTarget.firstName} ${requestTarget.lastName}`}
                    onClose={() => setRequestTarget(null)}
                    onSuccess={(msg) => {
                        showToast(msg);
                        load();
                    }}
                />
            )}
        </div>
    );
}
