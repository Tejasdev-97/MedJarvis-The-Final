import { User, ChevronRight } from "lucide-react";

export default function ProfileCard({

    profile,
    onSelect

}) {

    return (

        <button
            onClick={() => onSelect(profile)}
            className="
                w-full
                bg-white dark:bg-slate-900
                border
                border-[#E8E0D5] dark:border-slate-800
                rounded-2xl
                p-5
                flex
                items-center
                justify-between
                hover:border-[#2D6A4F] dark:hover:border-emerald-500
                hover:shadow-md
                transition
            "
        >

            <div className="flex items-center gap-4">

                <div
                    className="
                        w-12
                        h-12
                        rounded-full
                        bg-[#D8F3DC]
                        flex
                        items-center
                        justify-center
                    "
                >
                    <User className="text-[#2D6A4F]" />
                </div>

                <div className="text-left">

                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">

                        {profile.displayName || "User"}

                    </h3>

                    <p className="text-sm text-slate-500 dark:text-slate-400 capitalize">
                        {profile.role}
                    </p>

                </div>

            </div>

            <ChevronRight className="text-[#2D6A4F] dark:text-emerald-400" />

        </button>

    );

}