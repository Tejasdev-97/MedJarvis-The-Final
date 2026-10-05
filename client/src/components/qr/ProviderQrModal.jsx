import { useState, useEffect } from "react";
import { QrCode, X, Copy, Check, ShieldCheck, Building2, UserCheck } from "lucide-react";

export default function ProviderQrModal({ open, onClose, profile }) {
    const [copied, setCopied] = useState(false);

    if (!open) return null;

    const providerData = {
        type: "PROVIDER_CONSENT_QR",
        providerId: profile?._id || profile?.id || "",
        displayName: profile?.displayName || "Healthcare Provider",
        role: profile?.role || "Doctor",
        hospital: profile?.hospital || "MedJarvis Facility",
        employeeId: profile?.employeeId || "",
    };

    const qrData = JSON.stringify(providerData);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(qrData)}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(qrData);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-6 relative flex items-center justify-between">
                    <div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold text-emerald-100 mb-1">
                            <ShieldCheck size={14} />
                            Verified Provider Consent QR
                        </div>
                        <h2 className="text-xl font-bold">{profile?.displayName || "Provider"}</h2>
                        <p className="text-xs text-emerald-100 opacity-90 mt-0.5">
                            {profile?.role} {profile?.hospital ? `· ${profile.hospital}` : ""}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 text-center space-y-4">
                    <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 inline-block shadow-inner">
                        <img
                            src={qrUrl}
                            alt="Provider Consent QR"
                            className="w-56 h-56 object-contain mx-auto rounded-xl bg-white p-2 border border-slate-200"
                        />
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 max-w-xs mx-auto">
                        <p className="font-semibold text-slate-700 dark:text-slate-200">How to use this QR Code:</p>
                        <p>Ask your patient to scan this QR code using their MedJarvis Privacy Center or Patient App to grant you instant time-limited access.</p>
                    </div>

                    <div className="pt-2 flex justify-center">
                        <button
                            onClick={handleCopy}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-all"
                        >
                            {copied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
                            {copied ? "Copied QR Data!" : "Copy QR Data"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
