import {
    Ambulance,
    Building2,
    Heart,
    Shield,
    Stethoscope,
    UserRound
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

export default function RolesSection({ darkMode }) {
    const { t } = useLanguage();

    const roles = [
        {
            icon: Heart,
            title: t("Patients"),
            description: t("Manage medical records, monitor health, access AI assistance and securely share health information whenever needed."),
            color: "text-red-500",
            bg: "bg-red-100"
        },
        {
            icon: Stethoscope,
            title: t("Doctors"),
            description: t("Review patient history, receive AI-powered insights, manage appointments and provide better clinical decisions."),
            color: "text-green-600",
            bg: "bg-green-100"
        },
        {
            icon: UserRound,
            title: t("Health Workers"),
            description: t("Support rural healthcare through home visits, offline patient management and digital healthcare tools."),
            color: "text-blue-600",
            bg: "bg-blue-100"
        },
        {
            icon: Ambulance,
            title: t("Ambulance"),
            description: t("Receive emergency alerts, navigate efficiently and access essential patient information during emergencies."),
            color: "text-orange-500",
            bg: "bg-orange-100"
        },
        {
            icon: Building2,
            title: t("Hospitals"),
            description: t("Coordinate departments, manage patient flow and monitor healthcare resources from one platform."),
            color: "text-purple-600",
            bg: "bg-purple-100"
        },
        {
            icon: Shield,
            title: t("Administrators"),
            description: t("Monitor the platform, manage users, maintain security and oversee healthcare operations efficiently."),
            color: "text-indigo-600",
            bg: "bg-indigo-100"
        }
    ];

    return (
        <section
            id="roles"
            className="
                scroll-mt-24
                py-24
                px-6
            "
        >
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center max-w-3xl mx-auto">
                    <span
                        className="
                            inline-flex
                            items-center
                            rounded-full
                            bg-green-100
                            px-4
                            py-2
                            text-sm
                            font-semibold
                            text-[#2D6A4F]
                        "
                    >
                        {t("Built For Everyone")}
                    </span>

                    <h2
                        className={`
                            mt-6
                            text-4xl
                            lg:text-5xl
                            font-bold
                            ${darkMode ? "text-white" : "text-[#111827]"}
                        `}
                    >
                        {t("One Platform.")}
                        <br />
                        {t("Multiple Healthcare Roles.")}
                    </h2>

                    <p
                        className={`
                            mt-6
                            text-lg
                            leading-8
                            ${darkMode ? "text-gray-300" : "text-gray-600"}
                        `}
                    >
                        {t("MedJarvis connects every stakeholder in the healthcare ecosystem through one secure and intelligent platform.")}
                    </p>
                </div>

                {/* Cards */}
                <div className="mt-20 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
                    {roles.map((role) => {
                        const Icon = role.icon;

                        return (
                            <div
                                key={role.title}
                                className={`
                                    group
                                    rounded-3xl
                                    p-8
                                    shadow-lg
                                    transition-all
                                    duration-300
                                    hover:-translate-y-2
                                    hover:shadow-2xl
                                    ${darkMode ? 'bg-slate-900 text-slate-100 border border-slate-800' : 'bg-white text-gray-900'}
                                `}
                            >
                                <div
                                    className={`
                                        h-16
                                        w-16
                                        rounded-2xl
                                        flex
                                        items-center
                                        justify-center
                                        ${role.bg}
                                    `}
                                >
                                    <Icon
                                        size={30}
                                        className={role.color}
                                    />
                                </div>

                                <h3 className={`mt-6 text-2xl font-bold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>
                                    {role.title}
                                </h3>

                                <p className={`mt-4 leading-7 ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>
                                    {role.description}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}