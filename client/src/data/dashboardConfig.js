import {
    Users,
    ScanLine,
    Brain,
    FileText,
    HeartPulse,
    Ambulance,
    Shield,
    Settings,
    QrCode,
    UserPlus,
    Activity,
    Stethoscope,
    UserRound,
    Building2,
} from "lucide-react";

export const dashboardConfig = {

    /* ============================================================
       SUPER ADMIN
    ============================================================ */

    "Super Admin": {
        stats: [
            {
                title: "Users",
                value: "—",
                color: "#2563EB",
                icon: Users,
            },
            {
                title: "Patients",
                value: "—",
                color: "#2D6A4F",
                icon: HeartPulse,
            },
            {
                title: "Doctors",
                value: "—",
                color: "#F59E0B",
                icon: Stethoscope,
            },
            {
                title: "Health Workers",
                value: "—",
                color: "#059669",
                icon: UserRound,
            },
        ],

        actions: [
            {
                title: "Manage Profiles",
                icon: Users,
                path: "/users",
            },
            {
                title: "Hospitals",
                icon: Building2,
                path: "/hospitals",
            },
            {
                title: "Settings",
                icon: Settings,
                path: "/settings",
            },
        ],
    },

    /* ============================================================
       DOCTOR
    ============================================================ */

    Doctor: {
        stats: [
            {
                title: "Patients",
                value: "—",
                color: "#2563EB",
                icon: Users,
            },
            {
                title: "Prescriptions",
                value: "—",
                color: "#2D6A4F",
                icon: FileText,
            },
            {
                title: "Critical",
                value: "—",
                color: "#EF4444",
                icon: Activity,
            },
            {
                title: "Health Workers",
                value: "—",
                color: "#F59E0B",
                icon: UserRound,
            },
        ],

        actions: [
            {
                title: "Patients",
                icon: Users,
                path: "/patients",
            },
            {
                title: "Scan Patient",
                icon: ScanLine,
                path: "/scan-patient",
            },
            {
                title: "AI Health Summary",
                icon: Brain,
                path: "/ai",
            },
            {
                title: "Prescriptions",
                icon: FileText,
                path: "/prescriptions",
            },
        ],
    },

    /* ============================================================
       HEALTH WORKER
    ============================================================ */

    "Health Worker": {
        stats: [
            {
                title: "Patients",
                value: "—",
                color: "#2563EB",
                icon: Users,
            },
            {
                title: "Active Patients",
                value: "—",
                color: "#2D6A4F",
                icon: HeartPulse,
            },
            {
                title: "Observation",
                value: "—",
                color: "#F59E0B",
                icon: Activity,
            },
            {
                title: "Emergency",
                value: "—",
                color: "#EF4444",
                icon: Ambulance,
            },
        ],

        actions: [
            {
                title: "Register Patient",
                icon: UserPlus,
                path: "/register-patient",
            },
            {
                title: "Patients",
                icon: Users,
                path: "/patients",
            },
            {
                title: "Scan Patient",
                icon: ScanLine,
                path: "/scan-patient",
            },
            {
                title: "Vitals",
                icon: HeartPulse,
                path: "/vitals",
            },
        ],
    },

    /* ============================================================
       AMBULANCE STAFF
    ============================================================ */

    "Ambulance Staff": {
        stats: [
            {
                title: "Emergency",
                value: "—",
                color: "#EF4444",
                icon: Ambulance,
            },
            {
                title: "Patients",
                value: "—",
                color: "#2563EB",
                icon: Users,
            },
            {
                title: "Critical",
                value: "—",
                color: "#F59E0B",
                icon: Activity,
            },
            {
                title: "Healthy",
                value: "—",
                color: "#2D6A4F",
                icon: HeartPulse,
            },
        ],

        actions: [
            {
                title: "Scan Patient",
                icon: ScanLine,
                path: "/scan-patient",
            },
            {
                title: "Emergency",
                icon: Ambulance,
                path: "/emergency",
            },
            {
                title: "Patients",
                icon: Users,
                path: "/patients",
            },
            {
                title: "Settings",
                icon: Settings,
                path: "/settings",
            },
        ],
    },

    /* ============================================================
       HOSPITAL MANAGER
    ============================================================ */

    "Hospital Manager": {
        stats: [
            {
                title: "Doctors",
                value: "—",
                color: "#2563EB",
                icon: Stethoscope,
            },
            {
                title: "Health Workers",
                value: "—",
                color: "#2D6A4F",
                icon: Users,
            },
            {
                title: "Patients",
                value: "—",
                color: "#F59E0B",
                icon: HeartPulse,
            },
            {
                title: "Critical",
                value: "—",
                color: "#EF4444",
                icon: Activity,
            },
        ],

        actions: [
            {
                title: "Staff Profiles",
                icon: Users,
                path: "/users",
            },
            {
                title: "Patients",
                icon: HeartPulse,
                path: "/patients",
            },
            {
                title: "Scan Patient",
                icon: ScanLine,
                path: "/scan-patient",
            },
            {
                title: "Reports",
                icon: FileText,
                path: "/patients",
            },
        ],
    },

    /* ============================================================
       PATIENT
    ============================================================ */

    Patient: {
        stats: [
            {
                title: "Health Card",
                value: "Available",
                color: "#2563EB",
                icon: QrCode,
            },
            {
                title: "Vitals",
                value: "—",
                color: "#2D6A4F",
                icon: HeartPulse,
            },
            {
                title: "Prescriptions",
                value: "—",
                color: "#F59E0B",
                icon: FileText,
            },
            {
                title: "AI Summary",
                value: "Available",
                color: "#059669",
                icon: Brain,
            },
        ],

        actions: [
            {
                title: "Health Card",
                icon: QrCode,
                path: "/health-card",
            },
            {
                title: "My Health",
                icon: HeartPulse,
                path: "/vitals",
            },
            {
                title: "Prescriptions",
                icon: FileText,
                path: "/prescriptions",
            },
            {
                title: "AI Health Summary",
                icon: Brain,
                path: "/ai",
            },
        ],
    },
};