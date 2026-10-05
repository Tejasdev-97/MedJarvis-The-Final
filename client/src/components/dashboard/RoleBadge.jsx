export default function RoleBadge({ role }) {

    const colors = {
        "Super Admin": "bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300 dark:border dark:border-red-800",
        Doctor: "bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 dark:border dark:border-blue-800",
        "Health Worker": "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border dark:border-emerald-800",
        "Hospital Manager": "bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 dark:border dark:border-purple-800",
        "Ambulance Staff": "bg-orange-100 text-orange-700 dark:bg-orange-950/70 dark:text-orange-300 dark:border dark:border-orange-800",
        Patient: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/70 dark:text-cyan-300 dark:border dark:border-cyan-800",
    };

    return (
        <span
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors duration-200 ${colors[role] || "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}
        >
            {role}
        </span>
    );

}