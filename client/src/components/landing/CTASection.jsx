import Button from "../common/Button";
import { useLanguage } from "../../context/LanguageContext";

export default function CTASection({ darkMode, navigate }) {
    const { t } = useLanguage();

    return (
        <section className="py-24 px-6">
            <div className="max-w-6xl mx-auto">
                <div
                    className="
                        rounded-[32px]
                        bg-gradient-to-r
                        from-[#2D6A4F]
                        to-[#3A7D61]
                        px-8
                        py-16
                        lg:px-16
                        text-center
                        text-white
                        shadow-2xl
                    "
                >
                    {/* Heading */}
                    <h2 className="text-4xl lg:text-5xl font-bold">
                        {t("Ready to Experience")}
                        <br />
                        {t("Smarter Healthcare?")}
                    </h2>

                    {/* Description */}
                    <p
                        className="
                            mt-8
                            max-w-3xl
                            mx-auto
                            text-lg
                            leading-8
                            text-green-50
                        "
                    >
                        {t("Join MedJarvis to access AI-powered healthcare, secure digital health identity, connected wearable devices, multilingual assistance and seamless collaboration between patients, doctors, hospitals and emergency responders.")}
                    </p>

                    {/* Buttons */}
                    <div
                        className="
                            mt-12
                            flex
                            flex-wrap
                            justify-center
                            gap-5
                        "
                    >
                        <Button
                            onClick={() => navigate("/login")}
                            className="
                                bg-white
                                text-[#2D6A4F]
                                hover:bg-gray-100
                            "
                        >
                            {t("Get Started")}
                        </Button>

                        <button
                            onClick={() => {
                                const section =
                                    document.getElementById("features");

                                if (section) {
                                    section.scrollIntoView({
                                        behavior: "smooth"
                                    });
                                }
                            }}
                            className="
                                rounded-xl
                                border-2
                                border-white
                                px-7
                                py-3
                                font-semibold
                                transition
                                hover:bg-white
                                hover:text-[#2D6A4F]
                            "
                        >
                            {t("Learn More")}
                        </button>
                    </div>

                    {/* Statistics */}
                    <div
                        className="
                            mt-16
                            grid
                            gap-8
                            md:grid-cols-3
                        "
                    >
                        <div>
                            <h3 className="text-4xl font-bold">
                                AI
                            </h3>
                            <p className="mt-2 text-green-100">
                                {t("Intelligent Health Assistance")}
                            </p>
                        </div>

                        <div>
                            <h3 className="text-4xl font-bold">
                                24×7
                            </h3>
                            <p className="mt-2 text-green-100">
                                {t("Healthcare Availability")}
                            </p>
                        </div>

                        <div>
                            <h3 className="text-4xl font-bold">
                                {t("Secure")}
                            </h3>
                            <p className="mt-2 text-green-100">
                                {t("Privacy-First Digital Identity")}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}