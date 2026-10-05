export default function Card({
    children,
    className = "",
}) {
    return (
        <div
            className={`
                rounded-3xl
                shadow-xl
                border
                p-8
                transition-colors
                duration-300
                bg-white border-[#E8E0D5] text-slate-800
                dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100
                ${className}
            `}
        >
            {children}
        </div>
    );
}