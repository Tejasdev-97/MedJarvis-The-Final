import { useLanguage } from "../../context/LanguageContext";

export default function WorkflowSection({ darkMode }) {
    const { t } = useLanguage();

    return (
        <section
            id="workflow"
            className="
                scroll-mt-24
                py-24
                px-6
                bg-gradient-to-b
                from-transparent
                to-white/40
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
                            bg-orange-100
                            px-4
                            py-2
                            text-sm
                            font-semibold
                            text-orange-600
                        "
                    >
                        {t("Simple Workflow")}
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
                        {t("Healthcare in Four Simple Steps")}
                    </h2>

                    <p
                        className={`
                            mt-6
                            text-lg
                            leading-8
                            ${darkMode ? "text-gray-300" : "text-gray-600"}
                        `}
                    >
                        {t("From health monitoring to AI-powered insights and secure healthcare services, MedJarvis simplifies every step of the patient journey.")}
                    </p>
                </div>

                {/* Steps */}
                <div className="mt-20 grid gap-8 lg:grid-cols-4">
                    {[
                        {
                            number: "1",
                            color: "bg-green-100 text-[#2D6A4F]",
                            title: t("Monitor"),
                            description: t("Wearable devices and healthcare data continuously monitor important health parameters.")
                        },
                        {
                            number: "2",
                            color: "bg-blue-100 text-blue-600",
                            title: t("Analyze"),
                            description: t("AI evaluates health information and detects possible risks using intelligent analysis.")
                        },
                        {
                            number: "3",
                            color: "bg-orange-100 text-orange-600",
                            title: t("Connect"),
                            description: t("Doctors, caregivers and hospitals receive important information instantly.")
                        },
                        {
                            number: "4",
                            color: "bg-purple-100 text-purple-600",
                            title: t("Care"),
                            description: t("Faster response, smarter treatment and better healthcare experiences for everyone.")
                        }
                    ].map((step) => (
                        <div
                            key={step.number}
                            className={`
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
                                    h-14
                                    w-14
                                    rounded-full
                                    flex
                                    items-center
                                    justify-center
                                    text-2xl
                                    font-bold
                                    ${step.color}
                                `}
                            >
                                {step.number}
                            </div>

                            <h3 className={`mt-6 text-2xl font-bold ${darkMode ? 'text-white' : 'text-[#111827]'}`}>
                                {step.title}
                            </h3>

                            <p className={`mt-4 leading-7 ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>
                                {step.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}