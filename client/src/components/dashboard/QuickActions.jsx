import { useNavigate } from "react-router-dom";

export default function QuickActions({ actions }) {
    const navigate = useNavigate();

    return (
        <div className="bg-white border border-[#E8E0D5] text-slate-800 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 rounded-2xl p-6 shadow-sm mt-8 transition-colors duration-300">
            <h2 className="text-xl font-bold mb-5 text-gray-900 dark:text-slate-100">
                Quick Actions
            </h2>

            <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
                {actions.map((item) => {
                    const Icon = item.icon;

                    return (
                        <button
                            key={item.title}
                            onClick={() => navigate(item.path)}
                            className="group border border-[#E8E0D5] dark:border-slate-800 rounded-xl p-5 hover:bg-[#2D6A4F] hover:text-white dark:hover:bg-emerald-600 transition"
                        >
                            <Icon className="mx-auto mb-3 text-[#2D6A4F] dark:text-emerald-400 group-hover:text-white" />
                            <p className="font-medium text-sm text-gray-800 dark:text-slate-200 group-hover:text-white">{item.title}</p>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}