import {
    Clock,
    CheckCircle2,
} from "lucide-react";

export default function RecentActivity({ role }) {
    const activity = {
        "Super Admin": [
            "New Doctor profile created",
            "Hospital updated successfully",
            "System backup completed",
        ],
        Doctor: [
            "Prescription added",
            "Patient consultation completed",
            "AI summary generated",
        ],
        "Health Worker": [
            "New patient registered",
            "Village visit completed",
            "Vitals updated",
        ],
        "Ambulance Staff": [
            "Emergency patient scanned",
            "Patient transported",
            "Hospital notified",
        ],
        "Hospital Manager": [
            "Staff attendance updated",
            "Department report generated",
            "Inventory reviewed",
        ],
        Patient: [
            "Prescription updated",
            "Health Card downloaded",
            "Appointment scheduled",
        ],
    };

    return (
        <div className="bg-white border border-[#E8E0D5] text-slate-800 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 rounded-2xl shadow-sm p-6 transition-colors duration-300">
            <div className="flex items-center gap-2 mb-5">
                <Clock className="text-[#2D6A4F] dark:text-emerald-400" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                    Recent Activity
                </h2>
            </div>

            <div className="space-y-4">
                {(activity[role] || []).map((item) => (
                    <div
                        key={item}
                        className="flex items-center gap-3 border-b border-gray-100 dark:border-slate-800 pb-3"
                    >
                        <CheckCircle2
                            size={18}
                            className="text-green-600 dark:text-emerald-400 shrink-0"
                        />
                        <p className="text-sm font-medium text-gray-700 dark:text-slate-300">{item}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}