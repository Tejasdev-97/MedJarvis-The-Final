import { Bot, MessageCircle } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

export default function FloatingAI() {
    const { t } = useLanguage();

    return (
        <div
            className="
                fixed
                bottom-6
                right-6
                z-50
                group
            "
        >
            {/* Tooltip */}
            <div
                className="
                    absolute
                    right-20
                    top-1/2
                    -translate-y-1/2
                    rounded-xl
                    bg-[#111827]
                    px-4
                    py-2
                    text-sm
                    text-white
                    opacity-0
                    shadow-xl
                    transition-all
                    duration-300
                    group-hover:opacity-100
                    whitespace-nowrap
                    pointer-events-none
                "
            >
                {t("Ask MedJarvis AI")}
            </div>

            {/* Floating Button */}
            <button
                aria-label={t("Ask MedJarvis AI")}
                className="
                    relative
                    flex
                    h-16
                    w-16
                    items-center
                    justify-center
                    rounded-full
                    bg-gradient-to-r
                    from-[#2D6A4F]
                    to-[#3A7D61]
                    text-white
                    shadow-2xl
                    transition-all
                    duration-300
                    hover:scale-110
                    active:scale-95
                "
            >
                {/* Pulse Animation */}
                <span
                    className="
                        absolute
                        inset-0
                        rounded-full
                        animate-ping
                        bg-green-400
                        opacity-20
                    "
                />

                <Bot
                    size={30}
                    className="relative z-10"
                />
            </button>

            {/* Online Badge */}
            <div
                className="
                    absolute
                    -top-1
                    -right-1
                    flex
                    h-6
                    w-6
                    items-center
                    justify-center
                    rounded-full
                    bg-green-500
                    border-2
                    border-white
                "
            >
                <MessageCircle
                    size={12}
                    className="text-white"
                />
            </div>
        </div>
    );
}