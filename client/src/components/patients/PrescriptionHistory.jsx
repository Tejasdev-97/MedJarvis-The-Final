import { useEffect, useState } from "react";
import {
    Pill,
    UserRound,
    CalendarDays,
    ClipboardList,
} from "lucide-react";
import api from "../../services/api";

export default function PrescriptionHistory({ patientId }) {
    const [prescriptions, setPrescriptions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadHistory();
    }, [patientId]);

    async function loadHistory() {
        try {
            const res = await api.get(
                `/prescriptions/patient/${patientId}`
            );

            setPrescriptions(res.data.data || []);
        } catch {
            setPrescriptions([]);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl shadow-sm p-6 mt-8 transition-colors duration-200">
                Loading Prescriptions...
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl shadow-sm p-6 mt-8 transition-colors duration-200">

            <div className="flex items-center gap-3 mb-6">

                <ClipboardList
                    size={30}
                    className="text-[#2D6A4F] dark:text-emerald-400"
                />

                <div>

                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        Prescription History
                    </h2>

                    <p className="text-slate-500 dark:text-slate-400">
                        {prescriptions.length} Prescription(s)
                    </p>

                </div>

            </div>

            {prescriptions.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400">
                    No prescriptions found.
                </p>
            ) : (
                <div className="space-y-5">

                    {prescriptions.map((prescription) => (

                        <div
                            key={prescription._id}
                            className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 bg-slate-50/50 dark:bg-slate-800/30"
                        >

                            <div className="flex justify-between">

                                <div>

                                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">

                                        {prescription.diagnosis}

                                    </h3>

                                    <div className="flex items-center gap-2 mt-2 text-slate-500 dark:text-slate-400">

                                        <UserRound size={15} />

                                        {
                                            prescription.doctor
                                                ?.displayName
                                        }

                                    </div>

                                </div>

                                <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-sm">

                                    <CalendarDays size={15} />

                                    {new Date(
                                        prescription.createdAt
                                    ).toLocaleDateString()}

                                </div>

                            </div>

                            <div className="mt-5">

                                <h4 className="font-semibold flex items-center gap-2 text-slate-900 dark:text-slate-100">

                                    <Pill size={18} className="text-[#2D6A4F] dark:text-emerald-400" />

                                    Medicines

                                </h4>

                                <div className="mt-3 space-y-3">

                                    {prescription.medicines.map(
                                        (medicine, index) => (

                                            <div
                                                key={index}
                                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3"
                                            >

                                                <p className="font-semibold text-slate-900 dark:text-slate-100">

                                                    {
                                                        medicine.medicineName
                                                    }

                                                </p>

                                                <p className="text-slate-600 dark:text-slate-300 text-sm mt-1">

                                                    {medicine.dosage}

                                                    {" • "}

                                                    {
                                                        medicine.frequency
                                                    }

                                                    {" • "}

                                                    {
                                                        medicine.duration
                                                    }

                                                </p>

                                            </div>

                                        )
                                    )}

                                </div>

                            </div>

                            {prescription.notes && (
                                <div className="mt-5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4">

                                    <span className="font-semibold text-amber-900 dark:text-amber-300">

                                        Doctor Notes

                                    </span>

                                    <p className="mt-2 text-amber-800 dark:text-amber-200">

                                        {prescription.notes}

                                    </p>

                                </div>
                            )}

                        </div>

                    ))}

                </div>
            )}

        </div>
    );
}