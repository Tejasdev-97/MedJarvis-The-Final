import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Globe, ChevronDown, Moon, Sun, ArrowLeft } from "lucide-react";

import Card from "../components/common/Card";
import Logo from "../components/common/Logo";
import LoginForm from "../components/auth/LoginForm";

import { loginUser, saveToken } from "../services/authService";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";

export default function LoginPage() {
    const navigate = useNavigate();
    const { isDark, toggleTheme } = useTheme();
    const { language, setLanguage, t } = useLanguage();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async (data) => {
        console.log("HANDLE LOGIN", data);
        setLoading(true);
        setError("");

        try {
            const res = await loginUser(data.phone, data.pin);

            if (res.success) {
                if (res.multipleProfiles) {
                    localStorage.setItem("profiles", JSON.stringify(res.profiles));
                    navigate("/profiles");
                    return;
                }

                saveToken(res.token);
                localStorage.setItem("profile", JSON.stringify(res.profile));
                navigate("/dashboard");
            }
        } catch (err) {
            console.log("LOGIN ERROR:", err);
            console.log("STATUS:", err.response?.status);
            console.log("DATA:", err.response?.data);

            setError(err.response?.data?.message || t("Login Failed"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`min-h-screen flex flex-col justify-between transition-colors duration-300 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-[#FAF7F2] text-slate-800'}`}>
            {/* Header controls for Theme and Language */}
            <header className="p-4 sm:p-6 flex items-center justify-between max-w-7xl w-full mx-auto">
                <button
                    onClick={() => navigate('/')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition ${
                        isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'
                    }`}
                >
                    <ArrowLeft size={16} />
                    <span>{t("Back to Home")}</span>
                </button>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className={`appearance-none rounded-xl py-2 pl-9 pr-8 text-sm font-medium border outline-none cursor-pointer ${
                                isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-800'
                            }`}
                        >
                            <option>English</option>
                            <option>हिन्दी</option>
                            <option>ಕನ್ನಡ</option>
                            <option>मराठी</option>
                            <option>தமிழ்</option>
                            <option>తెలుగు</option>
                        </select>
                        <Globe size={16} className="absolute left-3 top-2.5 text-[#2D6A4F]" />
                        <ChevronDown size={14} className="absolute right-3 top-3 pointer-events-none opacity-60" />
                    </div>

                    <button
                        onClick={toggleTheme}
                        title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                        className={`h-9 w-9 rounded-xl border flex items-center justify-center transition ${
                            isDark ? 'bg-slate-800 border-slate-700 text-amber-400' : 'bg-white border-gray-300 text-slate-700'
                        }`}
                    >
                        {isDark ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                </div>
            </header>

            <div className="flex-1 flex items-center justify-center p-4">
                <Card className={`max-w-md w-full p-8 shadow-xl rounded-2xl ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
                    <div className="space-y-8">
                        <Logo center />

                        <div>
                            <h2 className="text-3xl font-serif text-center font-bold">
                                {t("Welcome Back")}
                            </h2>
                            <p className={`text-center mt-2 text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                                {t("Login using your registered phone number and PIN")}
                            </p>
                        </div>

                        <LoginForm
                            onSubmit={handleLogin}
                            loading={loading}
                            error={error}
                        />
                    </div>
                </Card>
            </div>

            <footer className={`py-4 text-center text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                MedJarvis &copy; {new Date().getFullYear()} — {t("Health Intelligence System")}
            </footer>
        </div>
    );
}