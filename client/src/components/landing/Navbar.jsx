import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Menu,
    X,
    Globe,
    ChevronDown,
    Moon,
    Sun
} from "lucide-react";

import Logo from "../common/Logo";
import Button from "../common/Button";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";

export default function Navbar() {
    const navigate = useNavigate();
    const { isDark, toggleTheme } = useTheme();
    const { language, setLanguage, supportedLanguages, t } = useLanguage();
    const darkMode = isDark;

    const [mobileMenu, setMobileMenu] = useState(false);

    return (
        <>
            <header
                className={`
                    fixed
                    top-0
                    left-0
                    right-0
                    z-50
                    backdrop-blur-xl
                    border-b
                    transition-all
                    duration-300
                    ${
                        darkMode
                            ? "bg-slate-900/90 border-slate-700"
                            : "bg-white/80 border-gray-200"
                    }
                `}
            >
                <div className="max-w-7xl mx-auto px-6">

                    <div className="h-20 flex items-center justify-between">

                        <Logo />

                        {/* Desktop Navigation */}

                        <nav className="hidden lg:flex items-center gap-8">

                            <a
                                href="#features"
                                className={`
                                    font-medium
                                    transition
                                    hover:text-[#2D6A4F]
                                    ${
                                        darkMode
                                            ? "text-gray-200"
                                            : "text-gray-700"
                                    }
                                `}
                            >
                                {t("Features")}
                            </a>

                            <a
                                href="#workflow"
                                className={`
                                    font-medium
                                    transition
                                    hover:text-[#2D6A4F]
                                    ${
                                        darkMode
                                            ? "text-gray-200"
                                            : "text-gray-700"
                                    }
                                `}
                            >
                                {t("Workflow")}
                            </a>

                            <a
                                href="#roles"
                                className={`
                                    font-medium
                                    transition
                                    hover:text-[#2D6A4F]
                                    ${
                                        darkMode
                                            ? "text-gray-200"
                                            : "text-gray-700"
                                    }
                                `}
                            >
                                {t("Roles")}
                            </a>

                            <a
                                href="#home"
                                className={`
                                    font-medium
                                    transition
                                    hover:text-[#2D6A4F]
                                    ${
                                        darkMode
                                            ? "text-gray-200"
                                            : "text-gray-700"
                                    }
                                `}
                            >
                                {t("Home")}
                            </a>

                        </nav>

                        {/* Right Side */}

                        <div className="hidden lg:flex items-center gap-4">

                            <div className="relative">

                                <select
                                    value={language}
                                    onChange={(e) =>
                                        setLanguage(e.target.value)
                                    }
                                    className={`
                                        appearance-none
                                        rounded-xl
                                        py-2
                                        pl-10
                                        pr-8
                                        border
                                        outline-none
                                        cursor-pointer
                                        ${
                                            darkMode
                                                ? "bg-slate-800 border-slate-700 text-white"
                                                : "bg-white border-gray-300 text-gray-800"
                                        }
                                    `}
                                >
                                    <option>English</option>
                                    <option>हिन्दी</option>
                                    <option>ಕನ್ನಡ</option>
                                    <option>मराठी</option>
                                    <option>தமிழ்</option>
                                    <option>తెలుగు</option>
                                </select>

                                <Globe
                                    size={18}
                                    className="absolute left-3 top-3 text-[#2D6A4F]"
                                />

                                <ChevronDown
                                    size={16}
                                    className="absolute right-3 top-3 pointer-events-none"
                                />

                            </div>

                            <button
                                onClick={toggleTheme}
                                title={darkMode ? t("Switch to Light Mode") : t("Switch to Dark Mode")}
                                className={`
                                    h-11
                                    w-11
                                    rounded-xl
                                    border
                                    flex
                                    items-center
                                    justify-center
                                    transition
                                    ${
                                        darkMode
                                            ? "bg-slate-800 border-slate-700 text-white"
                                            : "bg-white border-gray-300 text-gray-800"
                                    }
                                `}
                            >
                                {darkMode ? (
                                    <Sun size={20} />
                                ) : (
                                    <Moon size={20} />
                                )}
                            </button>

                            <Button
                                onClick={() =>
                                    navigate("/login")
                                }
                            >
                                {t("Sign In")}
                            </Button>

                        </div>

                        {/* Mobile Menu Button */}

                        <button
                            onClick={() =>
                                setMobileMenu(!mobileMenu)
                            }
                            className="lg:hidden"
                        >
                            {mobileMenu ? (
                                <X size={28} />
                            ) : (
                                <Menu size={28} />
                            )}
                        </button>

                    </div>

                </div>
            </header>

            {mobileMenu && (
                <div
                    className={`
                        fixed
                        top-20
                        left-0
                        right-0
                        z-40
                        shadow-xl
                        ${
                            darkMode
                                ? "bg-slate-900"
                                : "bg-white"
                        }
                    `}
                >
                    <div className="flex flex-col gap-5 p-6">

                        <a href="#features">{t("Features")}</a>

                        <a href="#workflow">{t("Workflow")}</a>

                        <a href="#roles">{t("Roles")}</a>

                        <a href="#home">{t("Home")}</a>

                        <Button
                            className="w-full"
                            onClick={() =>
                                navigate("/login")
                            }
                        >
                            {t("Sign In")}
                        </Button>

                    </div>
                </div>
            )}
        </>
    );
}