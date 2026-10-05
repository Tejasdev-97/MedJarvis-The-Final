import { useEffect, useState } from "react";
import api from "../services/api";

import StatCard from "../components/dashboard/StatCard";
import QuickActions from "../components/dashboard/QuickActions";
import RecentActivity from "../components/dashboard/RecentActivity";
import AlertsPanel from "../components/dashboard/AlertsPanel";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import RoleBadge from "../components/dashboard/RoleBadge";

import { dashboardConfig } from "../data/dashboardConfig";

import ProviderQrModal from "../components/qr/ProviderQrModal";
import ScanProviderQrModal from "../components/qr/ScanProviderQrModal";
import { QrCode, Camera } from "lucide-react";

export default function DashboardPage() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [providerQrOpen, setProviderQrOpen] = useState(false);
    const [scanQrOpen, setScanQrOpen] = useState(false);

    const profile = JSON.parse(
        localStorage.getItem("profile") || "{}"
    );

    const role = profile.role || "Patient";

    const config =
        dashboardConfig[role] ||
        dashboardConfig.Patient;

    useEffect(() => {
        let mounted = true;

        async function loadStats() {
            try {
                setLoading(true);
                setError("");

                const res = await api.get(
                    "/dashboard/stats"
                );

                if (mounted) {
                    setStats(
                        res.data?.data || null
                    );
                }
            } catch (err) {
                console.error(
                    "Dashboard stats error:",
                    err
                );

                if (mounted) {
                    setError(
                        err.response?.data?.message ||
                        "Unable to load live dashboard statistics."
                    );
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        loadStats();

        return () => {
            mounted = false;
        };
    }, []);

    function getStatValue(item) {
        if (loading) {
            return "…";
        }

        if (!stats) {
            return "—";
        }

        switch (item.title) {
            case "Health Card":
                return "Available";

            case "Vitals":
                if (stats.latestVital) {
                    const hr = stats.latestVital.heartRate !== null && stats.latestVital.heartRate !== undefined
                        ? `${stats.latestVital.heartRate} bpm`
                        : "";
                    const spo2 = stats.latestVital.spo2 !== null && stats.latestVital.spo2 !== undefined
                        ? `${stats.latestVital.spo2}% SpO₂`
                        : "";
                    return [hr, spo2].filter(Boolean).join(" / ") || "Recorded";
                }
                return "No readings yet";

            case "Prescriptions":
                if (stats.prescriptionCount !== undefined) {
                    return String(stats.prescriptionCount);
                }
                return stats.totalPrescriptions ?? "—";

            case "AI Summary":
                return stats.hasAiSummary ? "Available" : "Not generated";

            case "Users":
                return stats.totalUsers ?? "—";

            case "Hospitals":
                return stats.totalHospitals ?? "—";

            case "Doctors":
                return stats.totalDoctors ?? "—";

            case "Health Workers":
                return stats.totalHealthWorkers ?? "—";

            case "Ambulance Staff":
                return stats.totalAmbulance ?? "—";

            case "Managers":
                return stats.totalManagers ?? "—";

            case "Patients":
                return stats.totalPatients ?? "—";

            case "Active Patients":
                return stats.activePatients ?? "—";

            case "Healthy":
                return stats.healthy ?? "—";

            case "Observation":
                return stats.observation ?? "—";

            case "Critical":
                return stats.critical ?? "—";

            case "Emergency":
                return stats.critical ?? "—";

            case "Today's Registrations":
                return stats.todayRegistrations ?? "—";

            default:
                return "—";
        }
    }

    function getStatSubtitle(item) {
        if (loading) {
            return "Loading live data...";
        }

        if (item.title === "Vitals" && stats?.latestVital?.createdAt) {
            const dateStr = new Date(stats.latestVital.createdAt).toLocaleDateString();
            return `Latest: ${dateStr}`;
        }

        if (item.title === "Vitals" && !stats?.latestVital) {
            return "No vitals recorded in DB";
        }

        if (item.title === "Prescriptions" && stats?.prescriptionCount !== undefined) {
            return `${stats.prescriptionCount} active record${stats.prescriptionCount === 1 ? "" : "s"}`;
        }

        if (item.title === "AI Summary") {
            return stats?.hasAiSummary ? "Generated & Ready" : "Generate in My Health";
        }

        if (item.title === "Health Card") {
            return "QR Code ready";
        }

        return "Live system data";
    }

    return (
        <div className="space-y-8">

            {/* =====================================================
                HEADER
            ====================================================== */}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <DashboardHeader
                        title={`Welcome, ${profile.displayName || "User"}`}
                        subtitle={role}
                    />
                    <div className="mt-2">
                        <RoleBadge role={role} />
                    </div>
                </div>

                <div>
                    {(role === "Doctor" || role === "Hospital Manager") && (
                        <button
                            onClick={() => setProviderQrOpen(true)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2D6A4F] hover:bg-[#1B4332] text-white rounded-xl font-bold text-xs shadow-sm transition-all"
                        >
                            <QrCode size={16} />
                            My Provider QR Code
                        </button>
                    )}

                    {role === "Patient" && (
                        <button
                            onClick={() => setScanQrOpen(true)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold text-xs shadow-md transition-all"
                        >
                            <Camera size={16} />
                            Scan Doctor / Hospital QR
                        </button>
                    )}
                </div>
            </div>

            {/* =====================================================
                ERROR
            ====================================================== */}

            {error && (
                <div
                    className="
                        rounded-2xl
                        border
                        border-[#F4A261]
                        bg-[#FFF8F1]
                        px-5
                        py-4
                        text-[#7C2D12]
                        font-medium
                    "
                >
                    {error}
                </div>
            )}


            {/* =====================================================
                STATISTICS
            ====================================================== */}

            <section>
                <div
                    className="
                        grid
                        grid-cols-1
                        sm:grid-cols-2
                        xl:grid-cols-4
                        gap-5
                    "
                >
                    {config.stats.map((item) => (
                        <StatCard
                            key={item.title}
                            title={item.title}
                            value={getStatValue(item)}
                            subtitle={getStatSubtitle(item)}
                            icon={item.icon}
                            color={item.color}
                        />
                    ))}
                </div>
            </section>


            {/* =====================================================
                ACTIONS + ACTIVITY
            ====================================================== */}

            <section
                className="
                    grid
                    grid-cols-1
                    xl:grid-cols-2
                    gap-6
                "
            >
                <QuickActions
                    actions={config.actions}
                />

                <RecentActivity
                    role={role}
                />
            </section>


            {/* =====================================================
                ALERTS
            ====================================================== */}

            <section>
                <AlertsPanel
                    role={role}
                />
            </section>

            {/* QR Modals */}
            <ProviderQrModal
                open={providerQrOpen}
                onClose={() => setProviderQrOpen(false)}
                profile={profile}
            />

            <ScanProviderQrModal
                open={scanQrOpen}
                onClose={() => setScanQrOpen(false)}
            />
        </div>
    );
}