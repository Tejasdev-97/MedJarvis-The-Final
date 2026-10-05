import { useState } from "react";
import {
    Plus,
    Trash2,
    Save,
    Loader2,
    AlertTriangle,
    ShieldAlert,
    ShieldCheck,
    ShieldX,
    X,
    CheckCircle2,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import {
    checkInteractions,
    SEVERITY_RANK,
} from "../data/drugInteractions";

const emptyMedicine = {
    medicineName: "",
    dosage: "",
    frequency: "",
    duration: "",
};

// ─────────────────────────────────────────────────────────────
// Drug Interaction Warning Modal
// ─────────────────────────────────────────────────────────────

function DrugInteractionModal({
    interactions,
    onConfirm,
    onCancel,
}) {
    const hasHigh = interactions.some((i) => i.severity === "HIGH");

    const sortedInteractions = [...interactions].sort(
        (a, b) =>
            (SEVERITY_RANK[b.severity] || 0) -
            (SEVERITY_RANK[a.severity] || 0)
    );

    const severityStyle = {
        HIGH: {
            bg: "bg-red-50 dark:bg-red-950/40",
            border: "border-red-300 dark:border-red-800",
            badge: "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300",
            icon: ShieldX,
            iconColor: "text-red-600 dark:text-red-400",
        },
        MODERATE: {
            bg: "bg-amber-50 dark:bg-amber-950/40",
            border: "border-amber-300 dark:border-amber-800",
            badge: "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300",
            icon: ShieldAlert,
            iconColor: "text-amber-600 dark:text-amber-400",
        },
        LOW: {
            bg: "bg-blue-50 dark:bg-blue-950/40",
            border: "border-blue-200 dark:border-blue-800",
            badge: "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300",
            icon: ShieldCheck,
            iconColor: "text-blue-600 dark:text-blue-400",
        },
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${hasHigh ? "bg-red-100 dark:bg-red-950" : "bg-amber-100 dark:bg-amber-950"}`}>
                            <AlertTriangle
                                size={24}
                                className={hasHigh ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}
                            />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                                Drug Interaction Warning
                            </h2>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                                {interactions.length} interaction{interactions.length > 1 ? "s" : ""} detected.
                                {hasHigh && " At least one HIGH severity interaction found."}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 p-2 rounded-lg"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Interaction list */}
                <div className="overflow-y-auto flex-1 p-6 space-y-4">
                    {sortedInteractions.map((interaction, idx) => {
                        const style = severityStyle[interaction.severity] || severityStyle.LOW;
                        const Icon = style.icon;
                        return (
                            <div
                                key={idx}
                                className={`rounded-2xl border p-4 ${style.bg} ${style.border}`}
                            >
                                <div className="flex items-start gap-3">
                                    <Icon size={20} className={`${style.iconColor} mt-0.5 flex-shrink-0`} />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap mb-2">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${style.badge}`}>
                                                {interaction.severity}
                                            </span>
                                            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                                {interaction.drugs.map(
                                                    (d) =>
                                                        d.charAt(0).toUpperCase() + d.slice(1)
                                                ).join(" + ")}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-5 mb-1">
                                            <span className="font-semibold">Effect: </span>
                                            {interaction.effect}
                                        </p>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-5">
                                            <span className="font-semibold">Recommendation: </span>
                                            {interaction.recommendation}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-200 dark:border-slate-800">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-5">
                        <span className="font-semibold">As the prescribing doctor</span>, you may override these warnings
                        and save the prescription. This action is recorded in the patient's medical timeline.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={onCancel}
                            className="flex-1 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 px-5 py-3 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                        >
                            Go Back & Revise
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-white transition ${
                                hasHigh
                                    ? "bg-red-600 hover:bg-red-700"
                                    : "bg-amber-600 hover:bg-amber-700"
                            }`}
                        >
                            <CheckCircle2 size={18} />
                            Acknowledge & Save Anyway
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────

export default function AddPrescriptionPage() {
    const navigate = useNavigate();
    const { patientId } = useParams();

    const [form, setForm] = useState({
        diagnosis: "",
        notes: "",
        medicines: [{ ...emptyMedicine }],
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [interactionWarnings, setInteractionWarnings] = useState([]);
    const [pendingSave, setPendingSave] = useState(false);

    function changeMedicine(index, field, value) {
        setForm((previous) => {
            const medicines = [...previous.medicines];
            medicines[index] = {
                ...medicines[index],
                [field]: value,
            };
            return { ...previous, medicines };
        });
    }

    function addMedicine() {
        setForm((previous) => ({
            ...previous,
            medicines: [
                ...previous.medicines,
                { ...emptyMedicine },
            ],
        }));
    }

    function removeMedicine(index) {
        setForm((previous) => {
            if (previous.medicines.length === 1) return previous;
            return {
                ...previous,
                medicines: previous.medicines.filter(
                    (_, medicineIndex) => medicineIndex !== index
                ),
            };
        });
    }

    async function doSavePrescription() {
        const validMedicines = form.medicines.filter(
            (medicine) => medicine.medicineName.trim()
        );

        try {
            setLoading(true);

            await api.post("/prescriptions", {
                patient: patientId,
                diagnosis: form.diagnosis.trim(),
                medicines: validMedicines,
                notes: form.notes.trim(),
            });

            alert("Prescription Added Successfully");
            navigate(`/patient-summary/${patientId}`);
        } catch (err) {
            console.error("Save prescription error:", err);
            setError(
                err.response?.data?.message ||
                "Unable to save prescription."
            );
        } finally {
            setLoading(false);
        }
    }

    async function savePrescription(e) {
        e.preventDefault();

        setError("");

        if (!patientId) {
            setError("Patient ID is missing.");
            return;
        }

        if (!form.diagnosis.trim()) {
            setError("Please enter the diagnosis.");
            return;
        }

        const validMedicines = form.medicines.filter(
            (medicine) => medicine.medicineName.trim()
        );

        if (validMedicines.length === 0) {
            setError("Please add at least one medicine.");
            return;
        }

        // ── Drug interaction check ──
        const medicineNames = validMedicines.map((m) => m.medicineName);
        const interactions = checkInteractions(medicineNames);

        if (interactions.length > 0) {
            setInteractionWarnings(interactions);
            setPendingSave(true);
            return; // Stop here; user must acknowledge
        }

        // ── No interactions: save directly ──
        await doSavePrescription();
    }

    return (
        <div className="max-w-5xl mx-auto">

            {/* Drug Interaction Modal */}
            {pendingSave && interactionWarnings.length > 0 && (
                <DrugInteractionModal
                    interactions={interactionWarnings}
                    onCancel={() => {
                        setPendingSave(false);
                        setInteractionWarnings([]);
                    }}
                    onConfirm={async () => {
                        setPendingSave(false);
                        setInteractionWarnings([]);
                        await doSavePrescription();
                    }}
                />
            )}

            <div className="mb-6">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                    Add Prescription
                </h1>
                <p className="text-[#4A4A4A] dark:text-slate-400 mt-1">
                    Add diagnosis, medicines and doctor notes to the
                    patient's medical record.
                </p>
            </div>

            {error && (
                <div className="mb-5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-xl px-4 py-3">
                    {error}
                </div>
            )}

            <form
                onSubmit={savePrescription}
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-[#E8E0D5] dark:border-slate-800 p-6 md:p-8 text-slate-900 dark:text-slate-100"
            >

                {/* DIAGNOSIS */}
                <div>
                    <label className="font-medium text-slate-800 dark:text-slate-200">
                        Diagnosis
                    </label>
                    <textarea
                        rows={3}
                        className="border border-[#E8E0D5] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg p-3 w-full mt-2 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                        value={form.diagnosis}
                        onChange={(e) =>
                            setForm((previous) => ({
                                ...previous,
                                diagnosis: e.target.value,
                            }))
                        }
                        placeholder="Enter diagnosis..."
                    />
                </div>

                {/* MEDICINES */}
                <div className="mt-7">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                            Medicines
                        </h2>
                        <button
                            type="button"
                            onClick={addMedicine}
                            className="bg-[#D8F3DC] dark:bg-emerald-950 text-[#2D6A4F] dark:text-emerald-300 px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-[#c5e9cc] dark:hover:bg-emerald-900 font-bold transition"
                        >
                            <Plus size={18} />
                            Add Medicine
                        </button>
                    </div>

                    <div className="space-y-4">
                        {form.medicines.map((medicine, index) => (
                            <div
                                key={index}
                                className="border border-[#E8E0D5] dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl p-4"
                            >
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                                        Medicine {index + 1}
                                    </h3>
                                    {form.medicines.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeMedicine(index)}
                                            className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 p-2 rounded-lg"
                                            title="Remove medicine"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>

                                <div className="grid md:grid-cols-2 gap-4">
                                    <input
                                        placeholder="Medicine Name"
                                        className="border border-[#E8E0D5] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg p-3 w-full focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                                        value={medicine.medicineName}
                                        onChange={(e) =>
                                            changeMedicine(
                                                index,
                                                "medicineName",
                                                e.target.value
                                            )
                                        }
                                    />
                                    <input
                                        placeholder="Dosage"
                                        className="border border-[#E8E0D5] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg p-3 w-full focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                                        value={medicine.dosage}
                                        onChange={(e) =>
                                            changeMedicine(
                                                index,
                                                "dosage",
                                                e.target.value
                                            )
                                        }
                                    />
                                    <input
                                        placeholder="Frequency"
                                        className="border border-[#E8E0D5] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg p-3 w-full focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                                        value={medicine.frequency}
                                        onChange={(e) =>
                                            changeMedicine(
                                                index,
                                                "frequency",
                                                e.target.value
                                            )
                                        }
                                    />
                                    <input
                                        placeholder="Duration"
                                        className="border border-[#E8E0D5] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg p-3 w-full focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                                        value={medicine.duration}
                                        onChange={(e) =>
                                            changeMedicine(
                                                index,
                                                "duration",
                                                e.target.value
                                            )
                                        }
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* NOTES */}
                <div className="mt-7">
                    <label className="font-medium text-slate-800 dark:text-slate-200">
                        Doctor Notes
                    </label>
                    <textarea
                        rows={4}
                        className="border border-[#E8E0D5] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg p-3 w-full mt-2 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                        value={form.notes}
                        onChange={(e) =>
                            setForm((previous) => ({
                                ...previous,
                                notes: e.target.value,
                            }))
                        }
                        placeholder="Additional instructions or notes..."
                    />
                </div>

                {/* ACTIONS */}
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-8">
                    <button
                        type="button"
                        onClick={() =>
                            navigate(`/patient-summary/${patientId}`)
                        }
                        disabled={loading}
                        className="border border-gray-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 px-6 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 font-bold transition disabled:opacity-60"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-[#2D6A4F] hover:bg-[#1B4332] dark:bg-emerald-600 dark:hover:bg-emerald-500 font-bold text-white px-6 py-3 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={19} className="animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={19} />
                                Save Prescription
                            </>
                        )}
                    </button>
                </div>

            </form>
        </div>
    );
}