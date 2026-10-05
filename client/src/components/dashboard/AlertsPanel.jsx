import { TriangleAlert } from "lucide-react";

export default function AlertsPanel({ role }) {
    const alerts = {
        "Super Admin": [
            "System healthy",
            "No security alerts",
        ],
        Doctor: [
            "2 Critical Patients",
            "Drug interaction reminder",
        ],
        "Health Worker": [
            "1 High Risk Pregnancy",
            "2 Home Visits Pending",
        ],
        "Ambulance Staff": [
            "Nearest PHC 4 km",
            "Emergency Alert Active",
        ],
        "Hospital Manager": [
            "Bed Occupancy 72%",
            "Inventory Low",
        ],
        Patient: [
            "Medicine Due Today",
            "Next Appointment Tomorrow",
        ],
    };

    return (
        <div className="bg-white border border-[#E8E0D5] text-slate-800 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 rounded-2xl shadow-sm p-6 transition-colors duration-300">
            <div className="flex gap-2 items-center mb-5">
                <TriangleAlert className="text-red-500" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                    Alerts
                </h2>
            </div>

            <div className="space-y-3">
                {(alerts[role] || []).map((item) => (
                    <div
                        key={item}
                        className="bg-[#FAF7F2] border border-[#E8E0D5] text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 rounded-xl p-4 font-medium text-sm"
                    >
                        {item}
                    </div>
                ))}
            </div>
        </div>
    );
}