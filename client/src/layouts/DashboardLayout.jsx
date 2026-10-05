import { useState } from "react";
import {
    NavLink,
    Outlet,
    useNavigate,
} from "react-router-dom";
import {
    ChevronLeft,
    ChevronRight,
    HeartPulse,
    LogOut,
    Menu,
    UserCircle,
    X,
    Sun,
    Moon,
    Globe,
} from "lucide-react";

import { logout } from "../services/authService";
import { dashboardMenus } from "../data/dashboardMenu";
import EmergencyOverlay from "../components/EmergencyOverlay";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";

export default function DashboardLayout() {
    const navigate = useNavigate();
    const { isDark, toggleTheme } = useTheme();
    const { language, setLanguage, supportedLanguages, t } = useLanguage();

    const [collapsed, setCollapsed] =
        useState(false);

    const [mobileOpen, setMobileOpen] =
        useState(false);

    const profile = JSON.parse(
        localStorage.getItem("profile") || "{}"
    );

    const role =
        profile.role ||
        "Patient";

    const menu =
        dashboardMenus[role] ||
        dashboardMenus.Patient;

    const logoutUser = () => {
        logout();

        localStorage.removeItem(
            "profile"
        );

        localStorage.removeItem(
            "profiles"
        );

        navigate("/login");
    };

    const closeMobileMenu = () => {
        setMobileOpen(false);
    };

    return (
        <div className={`min-h-dvh transition-colors duration-300 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-[#FAF7F2] text-gray-900'}`}>

            {mobileOpen && (
                <button
                    type="button"
                    aria-label="Close navigation"
                    onClick={
                        closeMobileMenu
                    }
                    className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] md:hidden"
                />
            )}

            <aside
                className={`
                    fixed inset-y-0 left-0 z-50 flex h-dvh flex-col
                    border-r transition-all duration-300 ease-in-out
                    md:translate-x-0
                    ${isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-[#E8E0D5] shadow-sm'}
                    ${collapsed
                        ? "md:w-[76px]"
                        : "md:w-[272px]"
                    }
                    w-[272px]
                    ${mobileOpen
                        ? "translate-x-0"
                        : "-translate-x-full"
                    }
                `}
            >

                <div
                    className={`
                        flex h-[72px] shrink-0 items-center border-b
                        ${isDark ? 'border-slate-800' : 'border-[#E3E7E4]'}
                        ${collapsed
                            ? "justify-center px-2"
                            : "justify-between px-4"
                        }
                    `}
                >
                    {collapsed ? (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E5F6EA] text-[#164B45] dark:bg-emerald-950 dark:text-emerald-300">
                            <HeartPulse size={22} strokeWidth={2.2} />
                        </div>
                    ) : (
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E5F6EA] text-[#164B45] dark:bg-emerald-950 dark:text-emerald-300">
                                <HeartPulse size={23} strokeWidth={2.2} />
                            </div>

                            <div className="min-w-0 leading-none">
                                <p className="truncate text-[21px] font-bold tracking-tight text-[#164B45] dark:text-emerald-400">
                                    MedJarvis
                                </p>

                                <p className="mt-1 truncate text-[11px] font-medium tracking-wide text-[#52645E] dark:text-slate-400">
                                    {t("Health Intelligence")}
                                </p>
                            </div>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() =>
                            setCollapsed(
                                (value) =>
                                    !value
                            )
                        }
                        aria-label={
                            collapsed
                                ? "Expand sidebar"
                                : "Collapse sidebar"
                        }
                        title={
                            collapsed
                                ? "Expand sidebar"
                                : "Collapse sidebar"
                        }
                        className={`
                            hidden h-8 w-8 shrink-0 items-center justify-center
                            rounded-lg bg-[#164B45] text-white
                            transition hover:bg-[#1B4332] md:flex
                            ${collapsed
                                ? ""
                                : "ml-2"
                            }
                        `}
                    >
                        {collapsed ? (
                            <ChevronRight
                                size={16}
                            />
                        ) : (
                            <ChevronLeft
                                size={16}
                            />
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={
                            closeMobileMenu
                        }
                        aria-label="Close sidebar"
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800 md:hidden"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div
                    className={`
                        shrink-0 border-b
                        ${isDark ? 'border-slate-800' : 'border-[#E8E0D5]'}
                        ${collapsed
                            ? "px-2 py-4"
                            : "px-4 py-3"
                        }
                    `}
                >
                    {collapsed ? (
                        <div className="flex justify-center">
                            <div
                                title={`${profile.displayName || "User"} • ${role}`}
                                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EDF3EF] text-[#2D6A4F] dark:bg-slate-800 dark:text-emerald-400"
                            >
                                <UserCircle
                                    size={23}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EDF3EF] text-[#2D6A4F] dark:bg-slate-800 dark:text-emerald-400">
                                <UserCircle
                                    size={24}
                                />
                            </div>

                            <div className="min-w-0">
                                <p className="text-[10px] font-medium text-gray-500 dark:text-slate-400">
                                    {t("Logged in as")}
                                </p>

                                <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-slate-100">
                                    {profile.displayName ||
                                        "User"}
                                </h3>

                                <span className="text-[11px] font-semibold text-[#2D6A4F] dark:text-emerald-400">
                                    {t(role)}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <nav
                    className={`
                        min-h-0 flex-1 overflow-hidden
                        ${collapsed
                            ? "px-2 py-4"
                            : "px-4 py-4"
                        }
                    `}
                >
                    <div className="space-y-1">
                        {menu.map(
                            (item) => {
                                const Icon =
                                    item.icon;

                                return (
                                    <NavLink
                                        key={
                                            item.path
                                        }
                                        to={
                                            item.path
                                        }
                                        onClick={
                                            closeMobileMenu
                                        }
                                        title={
                                            collapsed
                                                ? t(item.label)
                                                : undefined
                                        }
                                        className={({
                                            isActive,
                                        }) =>
                                            `
                                            group flex items-center rounded-xl
                                            transition-all duration-200
                                            ${collapsed
                                                ? "h-11 justify-center px-2"
                                                : "min-h-11 gap-3 px-3"
                                            }
                                            ${isActive
                                                ? "bg-[#2D6A4F] text-white shadow-sm dark:bg-emerald-600"
                                                : isDark
                                                    ? "text-slate-300 hover:bg-slate-800 hover:text-white"
                                                    : "text-gray-700 hover:bg-[#F2F7F4] hover:text-[#1B4332]"
                                            }
                                            `
                                        }
                                    >
                                        <Icon
                                            size={19}
                                            strokeWidth={
                                                2
                                            }
                                            className="shrink-0"
                                        />

                                        {!collapsed && (
                                            <span className="truncate text-sm font-medium">
                                                {t(item.label)}
                                            </span>
                                        )}
                                    </NavLink>
                                );
                            }
                        )}
                    </div>
                </nav>

                <div
                    className={`
                        mt-auto shrink-0 border-t
                        ${isDark ? 'border-slate-800' : 'border-[#E8E0D5]'}
                        ${collapsed
                            ? "p-3"
                            : "p-4"
                        }
                    `}
                >
                    <button
                        type="button"
                        onClick={
                            logoutUser
                        }
                        title={
                            collapsed
                                ? t("Logout")
                                : undefined
                        }
                        className={`
                            flex w-full items-center rounded-xl
                            bg-red-600 py-3 text-sm font-medium text-white
                            transition hover:bg-red-700
                            ${collapsed
                                ? "justify-center px-2"
                                : "justify-center gap-2 px-4"
                            }
                        `}
                    >
                        <LogOut
                            size={18}
                        />

                        {!collapsed && (
                            <span>
                                {t("Logout")}
                            </span>
                        )}
                    </button>
                </div>
            </aside>

            <main
                className={`
                    min-h-dvh
                    transition-[margin-left] duration-300 ease-in-out
                    ${collapsed
                        ? "md:ml-[76px]"
                        : "md:ml-[272px]"
                    }
                `}
            >
                {/* TOP HEADER CONTROLS (DESKTOP & MOBILE) */}
                <div className={`sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4 backdrop-blur transition-colors ${
                    isDark ? 'bg-slate-900/90 border-slate-800 text-slate-100' : 'bg-[#FAF7F2]/95 border-[#E8E0D5] text-gray-900'
                }`}>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setMobileOpen(true)}
                            aria-label="Open navigation"
                            className={`flex h-9 w-9 items-center justify-center rounded-xl shadow-sm md:hidden ${
                                isDark ? 'bg-slate-800 text-slate-100 ring-1 ring-slate-700' : 'bg-white text-[#2D6A4F] ring-1 ring-[#E8E0D5]'
                            }`}
                        >
                            <Menu size={20} />
                        </button>

                        <div className="flex items-center gap-2">
                            <HeartPulse size={20} className="text-[#2D6A4F] dark:text-emerald-400" />
                            <span className="text-base font-bold">
                                MedJarvis
                            </span>
                        </div>
                    </div>

                    {/* RIGHT TOP CONTROLS: LANGUAGE & THEME */}
                    <div className="flex items-center gap-3">
                        {/* Language Selector Dropdown */}
                        <div className="relative flex items-center">
                            <Globe size={16} className="absolute left-2.5 text-[#2D6A4F] dark:text-emerald-400 pointer-events-none" />
                            <select
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                                className={`appearance-none rounded-xl py-1.5 pl-8 pr-7 text-xs font-bold border outline-none cursor-pointer ${
                                    isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-gray-300 text-gray-800'
                                }`}
                            >
                                {supportedLanguages.map((lang) => (
                                    <option key={lang} value={lang}>
                                        {lang}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Theme Toggle Button */}
                        <button
                            type="button"
                            onClick={toggleTheme}
                            title={isDark ? t("Light Mode") : t("Dark Mode")}
                            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                                isDark ? 'border-slate-700 bg-slate-800 text-amber-400 hover:bg-slate-700' : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-100'
                            }`}
                        >
                            {isDark ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                    </div>
                </div>

                <div className="h-[calc(100dvh-56px)] overflow-x-hidden overflow-y-auto px-4 py-4 sm:px-6 md:h-dvh lg:h-dvh lg:px-8 lg:py-6">
                    <Outlet />
                </div>
            </main>
            <EmergencyOverlay />
        </div>
    );

}