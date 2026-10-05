import { ArrowUpRight } from "lucide-react";

export default function StatCard({
    title,
    value,
    subtitle,
    icon: Icon,
    color = "#2D6A4F",
}) {
    return (
        <div
            className="
                bg-white border-[#E8E0D5] text-slate-800
                dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100
                rounded-3xl
                border
                shadow-sm
                p-6
                transition-colors duration-300
            "
        >
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                        {title}
                    </p>

                    <h2
                        className="text-3xl font-bold mt-2 text-slate-900 dark:text-slate-100"
                    >
                        {value}
                    </h2>

                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
                        {subtitle}
                    </p>
                </div>

                <div
                    className="rounded-2xl p-3"
                    style={{
                        background: `${color}25`
                    }}
                >
                    <Icon
                        size={28}
                        style={{
                            color
                        }}
                    />
                </div>
            </div>

            <div className="mt-6 flex items-center gap-2 text-[#2D6A4F] dark:text-emerald-400">
                <ArrowUpRight size={18} />
                <span className="text-sm font-medium">
                    View Details
                </span>
            </div>
        </div>
    );
}