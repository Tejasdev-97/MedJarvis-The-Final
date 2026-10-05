import { useEffect, useState, useCallback } from "react";
import {
    Shield,
    ShieldCheck,
    ShieldX,
    ShieldAlert,
    Eye,
    EyeOff,
    Key,
    Clock,
    RefreshCw,
    CheckCircle,
    XCircle,
    AlertTriangle,
    User,
    ChevronDown,
    ChevronUp,
    Clipboard,
    Lock,
    Unlock,
} from "lucide-react";
import {
    getPendingRequests,
    getMyGrants,
    getAccessLedger,
    approveGrant,
    denyGrant,
    revokeGrant,
    setupConsentPin,
} from "../services/accessGrantService";
import ScanProviderQrModal from "../components/qr/ScanProviderQrModal";
import { Camera } from "lucide-react";

// (Keep helpers & scope labels)

// ── helpers ────────────────────────────────────────────────────
const SCOPE_LABELS = {
    PROFILE: "Profile & Demographics",
    MEDICAL_HISTORY: "Medical History",
    PRESCRIPTIONS: "Prescriptions",
    VITALS: "Vital Signs",
    VISIT_NOTES: "Doctor Visit Notes",
    MONITORING: "Health Monitoring",
    ALLERGIES: "Allergies",
    EXTERNAL_RECORDS: "External Records",
    AI_SUMMARY: "AI Health Summary",
    EMERGENCY_BASIC: "Emergency Basic Info",
    ALL: "All Data",
};

const STATUS_CONFIG = {
    ACTIVE: {
        label: "Active",
        color: "bg-emerald-100 text-emerald-700 border border-emerald-200",
        icon: ShieldCheck,
    },
    PENDING: {
        label: "Pending Approval",
        color: "bg-amber-100 text-amber-700 border border-amber-200",
        icon: ShieldAlert,
    },
    EMERGENCY: {
        label: "Emergency",
        color: "bg-red-100 text-red-700 border border-red-200",
        icon: ShieldAlert,
    },
    REVOKED: {
        label: "Revoked",
        color: "bg-slate-100 text-slate-600 border border-slate-200",
        icon: ShieldX,
    },
    DENIED: {
        label: "Denied",
        color: "bg-slate-100 text-slate-600 border border-slate-200",
        icon: ShieldX,
    },
};

function timeAgo(dateStr) {
    if (!dateStr) return "—";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

function formatDate(dateStr) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

// ── ScopeTag ───────────────────────────────────────────────────
function ScopeTag({ scope }) {
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
            {SCOPE_LABELS[scope] || scope}
        </span>
    );
}

// ── GrantCard ──────────────────────────────────────────────────
function GrantCard({ grant, onApprove, onDeny, onRevoke, loading }) {
    const [expanded, setExpanded] = useState(false);
    const cfg = STATUS_CONFIG[grant.status] || STATUS_CONFIG.PENDING;
    const Icon = cfg.icon;
    const providerName = grant.provider?.displayName || "Unknown Provider";
    const providerRole = grant.provider?.role || "";
    const providerHospital = grant.provider?.hospital || "";

    return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
            {/* Header */}
            <div className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
                    <User size={18} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {providerName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {providerRole}{providerHospital ? ` · ${providerHospital}` : ""}
                    </p>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
                    <Icon size={12} />
                    {cfg.label}
                </span>
                <button
                    onClick={() => setExpanded((x) => !x)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors ml-1"
                >
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
            </div>

            {/* Scopes */}
            <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                {grant.scopes?.map((s) => <ScopeTag key={s} scope={s} />)}
            </div>

            {/* Expanded details */}
            {expanded && (
                <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700 pt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                    {grant.purpose && (
                        <p><span className="font-medium text-slate-700 dark:text-slate-300">Purpose:</span> {grant.purpose}</p>
                    )}
                    {grant.requestMessage && (
                        <p><span className="font-medium text-slate-700 dark:text-slate-300">Message:</span> {grant.requestMessage}</p>
                    )}
                    <p><span className="font-medium text-slate-700 dark:text-slate-300">Requested:</span> {formatDate(grant.requestedAt)}</p>
                    {grant.grantedAt && (
                        <p><span className="font-medium text-slate-700 dark:text-slate-300">Granted:</span> {formatDate(grant.grantedAt)}</p>
                    )}
                    {grant.expiresAt && (
                        <p><span className="font-medium text-slate-700 dark:text-slate-300">Expires:</span> {formatDate(grant.expiresAt)}</p>
                    )}
                    <p><span className="font-medium text-slate-700 dark:text-slate-300">Consent method:</span> {grant.consentMethod || "—"}</p>
                    {grant.isEmergency && (
                        <p className="text-red-600 font-medium">⚠ Emergency break-glass access. Reason: {grant.emergencyReason}</p>
                    )}
                </div>
            )}

            {/* Actions */}
            {grant.status === "PENDING" && (
                <div className="flex gap-2 px-4 pb-4">
                    <button
                        onClick={() => onApprove(grant._id)}
                        disabled={loading}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-60"
                    >
                        <CheckCircle size={15} />
                        Approve
                    </button>
                    <button
                        onClick={() => onDeny(grant._id)}
                        disabled={loading}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-medium transition-all disabled:opacity-60"
                    >
                        <XCircle size={15} />
                        Deny
                    </button>
                </div>
            )}

            {grant.status === "ACTIVE" && (
                <div className="px-4 pb-4">
                    <button
                        onClick={() => onRevoke(grant._id)}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium border border-red-100 dark:border-red-800 transition-all disabled:opacity-60"
                    >
                        <Unlock size={15} />
                        Revoke Access
                    </button>
                </div>
            )}
        </div>
    );
}

// ── LedgerRow ──────────────────────────────────────────────────
function LedgerRow({ log }) {
    const isEmergency = log.isEmergency;
    const isDenied = log.result === "DENIED";

    return (
        <div className={`flex items-start gap-3 py-3 border-b border-slate-100 dark:border-slate-700/50 last:border-0 ${isEmergency ? "bg-red-50/40 dark:bg-red-900/10 rounded-lg px-2" : ""}`}>
            <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isEmergency ? "bg-red-100 dark:bg-red-900/30" : isDenied ? "bg-slate-100 dark:bg-slate-700" : "bg-indigo-50 dark:bg-indigo-900/20"}`}>
                {isEmergency ? (
                    <AlertTriangle size={14} className="text-red-600 dark:text-red-400" />
                ) : isDenied ? (
                    <EyeOff size={14} className="text-slate-500" />
                ) : (
                    <Eye size={14} className="text-indigo-600 dark:text-indigo-400" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-tight">
                    {log.profile?.displayName || "System"} <span className="font-normal text-slate-500 dark:text-slate-400">({log.profile?.role || log.role || "—"})</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{log.action}</p>
                {log.facility && (
                    <p className="text-xs text-slate-400 dark:text-slate-500">{log.facility}</p>
                )}
            </div>
            <div className="text-right flex-shrink-0">
                <p className={`text-xs font-semibold ${isDenied ? "text-red-500" : "text-slate-500 dark:text-slate-400"}`}>
                    {log.result || "—"}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{timeAgo(log.createdAt)}</p>
            </div>
        </div>
    );
}

// ── Main Page ──────────────────────────────────────────────────
export default function PrivacyCenterPage() {
    const [tab, setTab] = useState("active"); // active | pending | ledger | pin
    const [grants, setGrants] = useState([]);
    const [pending, setPending] = useState([]);
    const [ledger, setLedger] = useState([]);
    const [ledgerPage, setLedgerPage] = useState(1);
    const [ledgerTotal, setLedgerTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [pinResult, setPinResult] = useState(null);
    const [pinLoading, setPinLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [toast, setToast] = useState(null);
    const [scanQrOpen, setScanQrOpen] = useState(false);

    const showToast = (msg, type = "success") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const loadGrants = useCallback(async () => {
        try {
            setLoading(true);
            const res = await getMyGrants();
            setGrants(res.data.data || []);
        } catch {
            showToast("Failed to load active grants.", "error");
        } finally {
            setLoading(false);
        }
    }, []);

    const loadPending = useCallback(async () => {
        try {
            setLoading(true);
            const res = await getPendingRequests();
            setPending(res.data.data || []);
        } catch {
            showToast("Failed to load pending requests.", "error");
        } finally {
            setLoading(false);
        }
    }, []);

    const loadLedger = useCallback(async (page = 1) => {
        try {
            setLoading(true);
            const res = await getAccessLedger(page, 20);
            setLedger(res.data.data || []);
            setLedgerTotal(res.data.pagination?.total || 0);
            setLedgerPage(page);
        } catch {
            showToast("Failed to load access ledger.", "error");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (tab === "active") loadGrants();
        else if (tab === "pending") loadPending();
        else if (tab === "ledger") loadLedger(1);
    }, [tab]);

    const handleApprove = async (grantId) => {
        try {
            setActionLoading(true);
            await approveGrant(grantId);
            showToast("Access granted successfully.");
            loadPending();
            loadGrants();
        } catch (err) {
            showToast(err.response?.data?.message || "Failed to approve.", "error");
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeny = async (grantId) => {
        try {
            setActionLoading(true);
            await denyGrant(grantId);
            showToast("Request denied.");
            loadPending();
        } catch (err) {
            showToast(err.response?.data?.message || "Failed to deny.", "error");
        } finally {
            setActionLoading(false);
        }
    };

    const handleRevoke = async (grantId) => {
        if (!window.confirm("Revoke this provider's access to your health data?")) return;
        try {
            setActionLoading(true);
            await revokeGrant(grantId);
            showToast("Access revoked.");
            loadGrants();
        } catch (err) {
            showToast(err.response?.data?.message || "Failed to revoke.", "error");
        } finally {
            setActionLoading(false);
        }
    };

    const handleSetupPin = async () => {
        if (!window.confirm("Generate a new Consent PIN? Your old PIN (if any) will be replaced.")) return;
        try {
            setPinLoading(true);
            const res = await setupConsentPin();
            setPinResult(res.data.pin);
        } catch (err) {
            showToast(err.response?.data?.message || "Failed to generate PIN.", "error");
        } finally {
            setPinLoading(false);
        }
    };

    const handleCopyPin = () => {
        if (pinResult) {
            navigator.clipboard.writeText(pinResult);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const pendingCount = pending.length;
    const activeCount = grants.filter((g) => g.status === "ACTIVE").length;

    const TABS = [
        { key: "active", label: "Active Access", icon: ShieldCheck, badge: activeCount },
        { key: "pending", label: "Requests", icon: ShieldAlert, badge: pendingCount },
        { key: "ledger", label: "Access Ledger", icon: Eye, badge: null },
        { key: "pin", label: "Consent PIN", icon: Key, badge: null },
    ];

    return (
        <div className="max-w-2xl mx-auto space-y-5 pb-10">

            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-2xl shadow-2xl text-sm font-medium flex items-center gap-2 transition-all ${toast.type === "error" ? "bg-red-600 text-white" : "bg-emerald-600 text-white"}`}>
                    {toast.type === "error" ? <AlertTriangle size={15} /> : <CheckCircle size={15} />}
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                        <Shield size={22} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Privacy Center</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Control who can access your health records</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setScanQrOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-semibold shadow-md transition-all"
                    >
                        <Camera size={15} />
                        Scan Doctor / Hospital QR
                    </button>
                    <button
                        onClick={() => {
                            if (tab === "active") loadGrants();
                            else if (tab === "pending") loadPending();
                            else if (tab === "ledger") loadLedger(1);
                        }}
                        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                    >
                        <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {/* Stat pills */}
            <div className="flex gap-3 flex-wrap">
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800">
                    <ShieldCheck size={16} className="text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{activeCount} Active</span>
                </div>
                {pendingCount > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800">
                        <ShieldAlert size={16} className="text-amber-600" />
                        <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">{pendingCount} Pending</span>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                {TABS.map(({ key, label, icon: Icon, badge }) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-semibold transition-all ${tab === key ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
                    >
                        <Icon size={13} />
                        {label}
                        {badge > 0 && (
                            <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold">
                                {badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── ACTIVE GRANTS ── */}
            {tab === "active" && (
                <div className="space-y-3">
                    {loading && (
                        <div className="flex justify-center py-8">
                            <RefreshCw size={22} className="animate-spin text-indigo-500" />
                        </div>
                    )}
                    {!loading && grants.length === 0 && (
                        <div className="text-center py-12">
                            <ShieldCheck size={44} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                            <p className="text-slate-500 dark:text-slate-400 font-medium">No providers currently have access.</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Your data is private.</p>
                        </div>
                    )}
                    {grants.map((g) => (
                        <GrantCard
                            key={g._id}
                            grant={g}
                            onApprove={handleApprove}
                            onDeny={handleDeny}
                            onRevoke={handleRevoke}
                            loading={actionLoading}
                        />
                    ))}
                </div>
            )}

            {/* ── PENDING REQUESTS ── */}
            {tab === "pending" && (
                <div className="space-y-3">
                    {loading && (
                        <div className="flex justify-center py-8">
                            <RefreshCw size={22} className="animate-spin text-indigo-500" />
                        </div>
                    )}
                    {!loading && pending.length === 0 && (
                        <div className="text-center py-12">
                            <ShieldAlert size={44} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                            <p className="text-slate-500 dark:text-slate-400 font-medium">No pending access requests.</p>
                        </div>
                    )}
                    {pending.map((g) => (
                        <GrantCard
                            key={g._id}
                            grant={g}
                            onApprove={handleApprove}
                            onDeny={handleDeny}
                            onRevoke={handleRevoke}
                            loading={actionLoading}
                        />
                    ))}
                </div>
            )}

            {/* ── ACCESS LEDGER ── */}
            {tab === "ledger" && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100">Who accessed your data</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Full chronological access log · {ledgerTotal} total entries</p>
                    </div>
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <RefreshCw size={22} className="animate-spin text-indigo-500" />
                        </div>
                    ) : ledger.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 dark:text-slate-500">
                            <Eye size={36} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm">No access records yet.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-700/50 px-4">
                            {ledger.map((log) => (
                                <LedgerRow key={log._id} log={log} />
                            ))}
                        </div>
                    )}
                    {ledgerTotal > 20 && (
                        <div className="px-4 py-3 flex justify-between items-center border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                            <button
                                disabled={ledgerPage <= 1}
                                onClick={() => loadLedger(ledgerPage - 1)}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                                Previous
                            </button>
                            <span className="text-xs text-slate-400 dark:text-slate-500">Page {ledgerPage}</span>
                            <button
                                disabled={ledgerPage * 20 >= ledgerTotal}
                                onClick={() => loadLedger(ledgerPage + 1)}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── CONSENT PIN ── */}
            {tab === "pin" && (
                <div className="space-y-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                                <Key size={18} className="text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-800 dark:text-slate-100">Physical Consent PIN</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                    For use when you cannot approve access on your phone. Share this PIN with a health worker to grant temporary access.
                                </p>
                            </div>
                        </div>

                        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-100 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
                            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
                            <p>Only share this PIN with a verified health worker in-person. Anyone with this PIN can access your basic health records.</p>
                        </div>

                        {pinResult ? (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between bg-slate-900 dark:bg-slate-950 rounded-xl px-5 py-4">
                                    <span className="text-3xl font-mono font-bold text-white tracking-widest">
                                        {pinResult}
                                    </span>
                                    <button
                                        onClick={handleCopyPin}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
                                    >
                                        {copied ? <CheckCircle size={13} /> : <Clipboard size={13} />}
                                        {copied ? "Copied!" : "Copy"}
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                                    This PIN will not be shown again. Save it securely.
                                </p>
                                <button
                                    onClick={() => setPinResult(null)}
                                    className="w-full py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Clear
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleSetupPin}
                                disabled={pinLoading}
                                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-60"
                            >
                                {pinLoading ? <RefreshCw size={16} className="animate-spin" /> : <Key size={16} />}
                                Generate New Consent PIN
                            </button>
                        )}
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                        <h4 className="font-semibold text-slate-700 dark:text-slate-200 mb-3">How the PIN works</h4>
                        <ol className="space-y-2 text-sm text-slate-600 dark:text-slate-400 list-decimal list-inside">
                            <li>You generate a 6-digit PIN on this page.</li>
                            <li>Give the PIN to a health worker in person.</li>
                            <li>They enter the PIN + their staff ID to gain temporary access.</li>
                            <li>Access is limited to basic health info and lasts up to 4 hours.</li>
                            <li>You can generate a new PIN any time to invalidate the old one.</li>
                        </ol>
                    </div>
                </div>
            )}

            <ScanProviderQrModal
                open={scanQrOpen}
                onClose={() => setScanQrOpen(false)}
                onSuccess={(msg) => {
                    showToast(msg);
                    loadGrants();
                }}
            />
        </div>
    );
}
