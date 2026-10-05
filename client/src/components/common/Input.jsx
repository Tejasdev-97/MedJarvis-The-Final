export default function Input({
    label,
    error,
    className = "",
    ...props
}) {
    return (
        <div className="space-y-2">
            {label && (
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {label}
                </label>
            )}

            <input
                {...props}
                className={`
                    w-full
                    rounded-xl
                    border
                    px-4
                    py-3
                    outline-none
                    transition
                    bg-white border-[#E8E0D5] text-slate-900 placeholder:text-gray-400
                    dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500
                    focus:border-[#2D6A4F]
                    focus:ring-2
                    focus:ring-[#D8F3DC]
                    dark:focus:ring-emerald-950
                    ${className}
                `}
            />

            {error && (
                <p className="text-red-500 text-sm">
                    {error}
                </p>
            )}
        </div>
    );
}