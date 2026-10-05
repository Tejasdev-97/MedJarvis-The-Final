import { useEffect, useState } from "react";
import {
    Settings,
    User,
    ShieldCheck,
    Brain,
    Info,
    Languages,
} from "lucide-react";
import GeminiSettings from "../components/settings/GeminiSettings";
import TranslationSettings from "../components/settings/TranslationSettings";

export default function SettingsPage() {
    const [profile, setProfile] = useState({});

    useEffect(() => {
        try {
            const stored = JSON.parse(
                localStorage.getItem("profile") || "{}"
            );

            setProfile(stored);
        } catch {
            setProfile({});
        }
    }, []);

    const role = profile.role || "Patient";

    // Gemini is relevant to roles that can use AI features.
    const aiRoles = [
        "Super Admin",
        "Hospital Manager",
        "Doctor",
        "Health Worker",
        "Patient",
    ];

    const canUseAI = aiRoles.includes(role);

    return (
        <div className="max-w-5xl mx-auto space-y-6">

            {/* HEADER */}
            <div>
                <div className="flex items-center gap-3">

                    <div className="w-12 h-12 rounded-xl bg-[#D8F3DC] dark:bg-emerald-950 flex items-center justify-center">
                        <Settings
                            size={24}
                            className="text-[#2D6A4F] dark:text-emerald-400"
                        />
                    </div>

                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100">
                            Settings
                        </h1>

                        <p className="text-slate-600 dark:text-slate-400 mt-1">
                            Manage your MedJarvis account and application preferences.
                        </p>
                    </div>

                </div>
            </div>

            {/* PROFILE */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-[#E8E0D5] dark:border-slate-800 shadow-sm p-6">

                <div className="flex items-center gap-3 mb-5">

                    <User
                        size={22}
                        className="text-[#2D6A4F] dark:text-emerald-400"
                    />

                    <div>
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                            Profile
                        </h2>

                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Current signed-in profile
                        </p>
                    </div>

                </div>

                <div className="grid md:grid-cols-2 gap-4">

                    <div className="border dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-800/50">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Name
                        </p>

                        <p className="font-semibold mt-1 text-slate-900 dark:text-slate-100">
                            {profile.displayName ||
                                profile.name ||
                                "MedJarvis User"}
                        </p>
                    </div>

                    <div className="border dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-800/50">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Role
                        </p>

                        <p className="font-semibold mt-1 text-[#2D6A4F] dark:text-emerald-400">
                            {role}
                        </p>
                    </div>

                    <div className="border dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-800/50">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Employee ID
                        </p>

                        <p className="font-semibold mt-1 text-slate-900 dark:text-slate-100">
                            {profile.employeeId || "—"}
                        </p>
                    </div>

                    <div className="border dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-800/50">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Hospital
                        </p>

                        <p className="font-semibold mt-1 text-slate-900 dark:text-slate-100">
                            {profile.hospital || "—"}
                        </p>
                    </div>

                </div>

            </section>

            {/* SECURITY */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-[#E8E0D5] dark:border-slate-800 shadow-sm p-6">

                <div className="flex items-center gap-3">

                    <ShieldCheck
                        size={22}
                        className="text-[#2D6A4F] dark:text-emerald-400"
                    />

                    <div>
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                            Security
                        </h2>

                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Your access is controlled by your MedJarvis role.
                        </p>
                    </div>

                </div>

                <div className="mt-5 bg-[#F7FAF8] dark:bg-slate-800/70 border dark:border-slate-700 rounded-xl p-4">

                    <p className="font-medium text-slate-900 dark:text-slate-100">
                        Role-based access is enabled
                    </p>

                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                        Your account can only access functionality permitted for the{" "}
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {role}
                        </span>{" "}
                        role.
                    </p>

                </div>

            </section>

            {/* TRANSLATION SETTINGS */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-[#E8E0D5] dark:border-slate-800 shadow-sm p-6">
                <div className="flex items-center gap-3 mb-5">
                    <Languages
                        size={22}
                        className="text-[#2D6A4F] dark:text-emerald-400"
                    />
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                            Multilingual Translation Settings
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Configure Google Cloud Translation API for dynamic live translations.
                        </p>
                    </div>
                </div>

                <TranslationSettings />
            </section>

            {/* AI SETTINGS */}
            {canUseAI && (
                <section className="bg-white dark:bg-slate-900 rounded-2xl border border-[#E8E0D5] dark:border-slate-800 shadow-sm p-6">

                    <div className="flex items-center gap-3 mb-5">

                        <Brain
                            size={22}
                            className="text-[#2D6A4F] dark:text-emerald-400"
                        />

                        <div>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                                AI Settings
                            </h2>

                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Configure the Gemini API used by MedJarvis AI features.
                            </p>
                        </div>

                    </div>

                    <GeminiSettings />

                </section>
            )}

            {/* INFO */}
            <section className="bg-[#F7FAF8] dark:bg-slate-900 border dark:border-slate-800 rounded-2xl p-5">

                <div className="flex gap-3">

                    <Info
                        size={21}
                        className="text-[#2D6A4F] dark:text-emerald-400 shrink-0"
                    />

                    <div>
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                            MedJarvis Settings
                        </h3>

                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-6">
                            Available settings depend on your role and the
                            features assigned to your profile.
                        </p>
                    </div>

                </div>

            </section>

        </div>
    );
}