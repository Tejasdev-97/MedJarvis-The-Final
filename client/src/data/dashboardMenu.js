import {
    LayoutDashboard,
    Users,
    HeartPulse,
    FileText,
    Ambulance,
    ScanLine,
    Settings,
    QrCode,
    Brain,
    UserPlus,
    ClipboardList,
    Shield,
    FolderOpen,
    Building2,
    Activity,
} from "lucide-react";

export const dashboardMenus = {

    Patient: [
        {
            label: "Dashboard",
            icon: LayoutDashboard,
            path: "/my-health",
        },
        {
            label: "Health Card",
            icon: QrCode,
            path: "/health-card",
        },
        {
            label: "Medical History",
            icon: ClipboardList,
            path: "/medical-history",
        },
        {
            label: "Prescriptions",
            icon: FileText,
            path: "/prescriptions",
        },
        {
            label: "External Records",
            icon: FolderOpen,
            path: "/external-records",
        },
        {
            label: "AI Health Summary",
            icon: Brain,
            path: "/ai",
        },
        {
            label: "Privacy Center",
            icon: Shield,
            path: "/privacy",
        },
        {
            label: "Emergency",
            icon: Ambulance,
            path: "/emergency",
        },
        {
            label: "Settings",
            icon: Settings,
            path: "/settings",
        },
    ],

    Doctor: [
        {
            label: "Dashboard",
            icon: LayoutDashboard,
            path: "/dashboard",
        },
        {
            label: "My Patients",
            icon: HeartPulse,
            path: "/patients",
        },
        {
            label: "Scan Patient",
            icon: ScanLine,
            path: "/scan-patient",
        },
        {
            label: "Health Monitoring",
            icon: Activity,
            path: "/monitoring",
        },
        {
            label: "Settings",
            icon: Settings,
            path: "/settings",
        },
    ],

    "Health Worker": [
        {
            label: "Dashboard",
            icon: LayoutDashboard,
            path: "/dashboard",
        },
        {
            label: "Register Patient",
            icon: UserPlus,
            path: "/register-patient",
        },
        {
            label: "My Patients",
            icon: HeartPulse,
            path: "/patients",
        },
        {
            label: "Scan Patient",
            icon: ScanLine,
            path: "/scan-patient",
        },
        {
            label: "Health Monitoring",
            icon: Activity,
            path: "/monitoring",
        },
        {
            label: "Settings",
            icon: Settings,
            path: "/settings",
        },
    ],

    "Ambulance Staff": [
        {
            label: "Dashboard",
            icon: LayoutDashboard,
            path: "/dashboard",
        },
        {
            label: "Emergency Scan",
            icon: ScanLine,
            path: "/scan-patient",
        },
        {
            label: "Emergency Cases",
            icon: Ambulance,
            path: "/emergency",
        },
        {
            label: "Settings",
            icon: Settings,
            path: "/settings",
        },
    ],

    "Hospital Manager": [
        {
            label: "Dashboard",
            icon: LayoutDashboard,
            path: "/dashboard",
        },
        {
            label: "Staff Profiles",
            icon: Users,
            path: "/users",
        },
        {
            label: "My Patients",
            icon: HeartPulse,
            path: "/patients",
        },
        {
            label: "Scan Patient",
            icon: ScanLine,
            path: "/scan-patient",
        },
        {
            label: "Settings",
            icon: Settings,
            path: "/settings",
        },
    ],

    "Super Admin": [
        {
            label: "Dashboard",
            icon: LayoutDashboard,
            path: "/dashboard",
        },
        {
            label: "Hospitals",
            icon: Building2,
            path: "/hospitals",
        },
        {
            label: "Manage Profiles",
            icon: Users,
            path: "/users",
        },
        {
            label: "Settings",
            icon: Settings,
            path: "/settings",
        },
    ],
};