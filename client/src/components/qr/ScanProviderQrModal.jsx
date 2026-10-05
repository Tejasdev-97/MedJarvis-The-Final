import { useState } from "react";
import { Camera, X, CheckCircle, AlertTriangle, ShieldCheck, RefreshCw, UserCheck } from "lucide-react";
import CameraScanner from "../scan/CameraScanner";
import api from "../../services/api";

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

export default function ScanProviderQrModal({ open, onClose, onSuccess }) {
    const [scannedProvider, setScannedProvider] = useState(null);
    const [purpose, setPurpose] = useState("In-person medical consultation");
    const [scopes, setScopes] = useState(["PROFILE", "MEDICAL_HISTORY", "PRESCRIPTIONS", "VITALS"]);
    const [durationHours, setDurationHours] = useState(24);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    if (!open) return null;

    const handleDetected = (text) => {
        try {
            let data = null;
            if (text.startsWith("{")) {
                data = JSON.parse(text);
            } else {
                data = { providerId: text, displayName: "Healthcare Provider", role: "Doctor" };
            }

            if (data.type === "PROVIDER_CONSENT_QR" || data.providerId) {
                setScannedProvider(data);
                setError("");
            } else {
                setError("Invalid Provider QR Code format.");
            }
        } catch {
            setError("Could not read Provider QR Code.");
        }
    };

    const toggleScope = (val) => {
        setScopes((prev) =>
            prev.includes(val) ? prev.filter((s) => s !== val) : [...prev, val]
        );
    };

    const handleGrantAccess = async (e) => {
        e.preventDefault();
        if (!scannedProvider?.providerId) return;

        try {
            setLoading(true);
            setError("");

            // Create and immediately activate AccessGrant for this scanned provider
            const res = await api.post("/access-grants/request", {
                patientId: undefined, // backend resolves patient from patient profile
                providerId: scannedProvider.providerId,
                purpose,
                scopes,
                durationHours,
                consentMethod: "PATIENT_QR",
                status: "ACTIVE",
            });

            onSuccess?.("Access granted successfully to " + (scannedProvider.displayName || "Provider"));
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to grant access.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <Camera size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Scan Doctor / Hospital QR</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Point camera at provider's QR code</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto p-5 space-y-4 flex-1">
                    {!scannedProvider ? (
                        <div className="space-y-4">
                            <CameraScanner onDetected={handleDetected} onClose={() => {}} />
                            {error && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 text-xs rounded-xl flex items-center gap-2">
                                    <AlertTriangle size={14} />
                                    {error}
                                </div>
                            )}
                        </div>
                    ) : (
                        <form onSubmit={handleGrantAccess} className="space-y-4">
                            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                                    <UserCheck size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-slate-100">{scannedProvider.displayName}</h3>
                                    <p className="text-xs text-emerald-700 dark:text-emerald-400">{scannedProvider.role} {scannedProvider.hospital ? `· ${scannedProvider.hospital}` : ""}</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wide">Purpose of Visit</label>
                                <input
                                    type="text"
                                    value={purpose}
                                    onChange={(e) => setPurpose(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Select Allowed Data Scopes</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {ALL_SCOPES.map(({ value, label }) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => toggleScope(value)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all text-left ${scopes.includes(value) ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300" : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"}`}
                                        >
                                            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${scopes.includes(value) ? "bg-indigo-600 border-indigo-600" : "border-slate-300"}`}>
                                                {scopes.includes(value) && <CheckCircle size={10} className="text-white" />}
                                            </div>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wide">Duration</label>
                                <select
                                    value={durationHours}
                                    onChange={(e) => setDurationHours(parseInt(e.target.value))}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                >
                                    <option value={4}>4 Hours</option>
                                    <option value={24}>24 Hours</option>
                                    <option value={72}>3 Days</option>
                                    <option value={168}>1 Week</option>
                                </select>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl flex items-center gap-2">
                                    <AlertTriangle size={14} />
                                    {error}
                                </div>
                            )}

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setScannedProvider(null)}
                                    className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                    Rescan
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-sm font-semibold shadow-md disabled:opacity-60 transition-all"
                                >
                                    {loading ? <RefreshCw size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                                    Grant Access to Provider
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
