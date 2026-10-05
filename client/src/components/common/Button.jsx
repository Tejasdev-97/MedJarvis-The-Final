export default function Button({
    children,
    onClick,
    type = "button",
    full = false,
    loading = false,
    variant = "primary",
    disabled = false,
}) {

    const variants = {
        primary:
            "bg-[#2D6A4F] hover:bg-[#1B4332] text-white dark:bg-emerald-600 dark:hover:bg-emerald-700",

        secondary:
            "bg-white border border-[#E8E0D5] text-[#2D6A4F] hover:bg-[#F8F8F8] dark:bg-slate-800 dark:border-slate-700 dark:text-emerald-400 dark:hover:bg-slate-700",

        danger:
            "bg-red-600 hover:bg-red-700 text-white",
    };


    return (
        <button
            type={type}
            onClick={onClick}
            disabled={loading || disabled}
            className={`
                ${full ? "w-full" : ""}
                px-5
                py-3
                rounded-xl
                font-semibold
                transition-all
                duration-200
                shadow-sm
                disabled:opacity-60
                disabled:cursor-not-allowed
                ${variants[variant]}
            `}
        >
            {loading ? "Please wait..." : children}
        </button>
    );
}