import { useState, useEffect } from "react";
import { Activity, HeartPulse, ShieldCheck, RefreshCw, UserCheck, AlertTriangle, ArrowRight, Search } from "lucide-react";
import { getMyPatients } from "../services/accessGrantService";
import MyHealthPage from "./MyHealthPage";
import api from "../services/api";

export default function MonitoringPage() {
    const [authorizedPatients, setAuthorizedPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        loadAuthorizedPatients();
    }, []);

    async function loadAuthorizedPatients() {
        try {
            setLoading(true);
            const res = await getMyPatients();
            setAuthorizedPatients(res.data?.data || []);
        } catch (err) {
            console.error("Failed to load authorized patients:", err);
            setAuthorizedPatients([]);
        } finally {
            setLoading(false);
        }
    }

    const filteredPatients = authorizedPatients.filter((p) => {
        const q = search.toLowerCase().trim();
        if (!q) return true;
        return (
            `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
            (p.medJarvisId || "").toLowerCase().includes(q)
        );
    });

    if (selectedPatient) {
        return (
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                            {selectedPatient.firstName?.[0]}{selectedPatient.lastName?.[0]}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="font-bold text-slate-800 dark:text-slate-100">
                                    {selectedPatient.firstName} {selectedPatient.lastName}
                                </h2>
                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 flex items-center gap-1">
                                    <ShieldCheck size={12} />
                                    Active Consent
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                ID: {selectedPatient.medJarvisId} · {selectedPatient.gender || "—"}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setSelectedPatient(null)}
                        className="self-start sm:self-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all"
                    >
                        Switch Patient
                    </button>
                </div>

                <MyHealthPage overridePatientId={selectedPatient._id || selectedPatient.id} />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-10">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg">
                    <Activity size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Health Monitoring</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Select an authorized patient to connect MedJarvis BLE Band and run Vitals Monitoring
                    </p>
                </div>
            </div>

            {/* Selection Card */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <ShieldCheck size={18} className="text-emerald-600" />
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                            Authorized Patients ({authorizedPatients.length})
                        </h2>
                    </div>

                    <div className="relative w-full sm:w-64">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search patient..."
                            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <RefreshCw size={24} className="animate-spin text-emerald-500" />
                    </div>
                ) : filteredPatients.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700/50">
                        <AlertTriangle size={36} className="mx-auto text-slate-400 mb-3" />
                        <h3 className="font-semibold text-slate-700 dark:text-slate-300">No authorized patients available</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                            You can only monitor patients who have granted active consent. Search for a patient in "My Patients" or scan their QR code to request consent.
                        </p>
                    </div>
                ) : (
                    <div className="grid sm:grid-cols-2 gap-3">
                        {filteredPatients.map((p) => (
                            <div
                                key={p._id || p.id}
                                onClick={() => setSelectedPatient(p)}
                                className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 rounded-2xl cursor-pointer transition-all group"
                            >
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                    {p.firstName?.[0]}{p.lastName?.[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                                        {p.firstName} {p.lastName}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {p.medJarvisId}
                                    </p>
                                </div>
                                <div className="p-2 rounded-xl bg-white dark:bg-slate-800 text-slate-400 group-hover:text-emerald-600 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50 transition-colors">
                                    <ArrowRight size={16} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
