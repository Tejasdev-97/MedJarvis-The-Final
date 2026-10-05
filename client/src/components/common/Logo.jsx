import { HeartPulse } from "lucide-react";

export default function Logo({
    center = false,
}) {
    return (
        <div
            className={`
                flex
                items-center
                gap-4
                ${center ? "justify-center" : ""}
            `}
        >
            <div
                className="
                    w-14
                    h-14
                    rounded-full
                    bg-[#D8F3DC]
                    flex
                    items-center
                    justify-center
                    shrink-0
                    shadow-sm
                "
            >
                <HeartPulse
                    size={28}
                    className="text-[#2D6A4F]"
                />
            </div>

            <div>
                <h2 className="font-serif text-3xl text-[#2D6A4F] dark:text-[#40916C]">
                    MedJarvis
                </h2>

                <p className="text-gray-500 dark:text-slate-400 text-sm">
                    Rural Health Intelligence
                </p>
            </div>
        </div>
    );
}