export default function DashboardHeader({ title, subtitle }) {
    return (
        <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-slate-100">
                {title}
            </h1>
            <p className="text-gray-500 dark:text-slate-400 mt-2 font-medium">
                {subtitle}
            </p>
        </div>
    );
}