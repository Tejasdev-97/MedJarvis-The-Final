import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
} from "react-router-dom";

import DashboardLayout from "../layouts/DashboardLayout";

import MyHealthPage from "../pages/MyHealthPage";
import LandingPage from "../pages/LandingPage";
import LoginPage from "../pages/LoginPage";
import DashboardPage from "../pages/DashboardPage";
import ProfileSelectionPage from "../pages/ProfileSelectionPage";
import HealthCardPage from "../pages/HealthCardPage";
import PatientsPage from "../pages/PatientsPage";
import MyPatientsPage from "../pages/MyPatientsPage";
import ScanPatientPage from "../pages/ScanPatientPage";
import SettingsPage from "../pages/SettingsPage";
import PatientSummaryPage from "../pages/PatientSummaryPage";
import MedicalHistoryPage from "../pages/MedicalHistoryPage";
import PrescriptionsPage from "../pages/PrescriptionsPage";
import AIHealthSummaryPage from "../pages/AIHealthSummaryPage";
import EmergencyPage from "../pages/EmergencyPage";
import PrivacyCenterPage from "../pages/PrivacyCenterPage";

import ComingSoonPage from "../pages/ComingSoonPage";
import UsersPage from "../pages/UsersPage";
import RegisterPatientPage from "../pages/RegisterPatientPage";
import AddPrescriptionPage from "../pages/AddPrescriptionPage";

import ProtectedRoute from "./ProtectedRoute";
import DoctorVisitPage from "../pages/DoctorVisitPage";
import MonitoringPage from "../pages/MonitoringPage";

export default function AppRouter() {
    return (
        <BrowserRouter>
            <Routes>
                {/* PUBLIC */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/profiles" element={<ProfileSelectionPage />} />

                {/* PROTECTED APPLICATION */}
                <Route
                    element={
                        <ProtectedRoute>
                            <DashboardLayout />
                        </ProtectedRoute>
                    }
                >
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/patients" element={<MyPatientsPage />} />
                    <Route path="/all-patients" element={<PatientsPage />} />
                    <Route path="/register-patient" element={<RegisterPatientPage />} />
                    <Route path="/scan-patient" element={<ScanPatientPage />} />
                    <Route path="/patient-summary/:patientId" element={<PatientSummaryPage />} />
                    <Route path="/add-prescription/:patientId" element={<AddPrescriptionPage />} />

                    <Route path="/visits" element={<DoctorVisitPage />} />
                    <Route path="/visits/:patientId" element={<DoctorVisitPage />} />

                    <Route path="/medical-history" element={<MedicalHistoryPage />} />
                    <Route path="/prescriptions" element={<PrescriptionsPage />} />
                    <Route path="/external-records" element={<ComingSoonPage />} />

                    <Route path="/health-card" element={<HealthCardPage />} />
                    <Route path="/health-card/:patientId" element={<HealthCardPage />} />

                    <Route path="/vitals" element={<MyHealthPage />} />
                    <Route path="/my-health" element={<MyHealthPage />} />
                    <Route path="/monitoring" element={<MonitoringPage />} />


                    {/* =================================================
                        AI
                    ================================================== */}

                    <Route
                        path="/ai"
                        element={<AIHealthSummaryPage />}
                    />


                    {/* =================================================
                        EMERGENCY
                    ================================================== */}

                    <Route
                        path="/emergency"
                        element={<EmergencyPage />}
                    />


                    {/* =================================================
                        PRIVACY CENTER  (patient-facing)
                    ================================================== */}

                    <Route
                        path="/privacy"
                        element={<PrivacyCenterPage />}
                    />


                    {/* =================================================
                        ADMIN / MANAGEMENT
                    ================================================== */}

                    <Route
                        path="/users"
                        element={<UsersPage />}
                    />

                    <Route
                        path="/hospitals"
                        element={<ComingSoonPage />}
                    />

                    <Route
                        path="/audit"
                        element={<ComingSoonPage />}
                    />

                    <Route
                        path="/departments"
                        element={<ComingSoonPage />}
                    />

                    <Route
                        path="/staff"
                        element={<ComingSoonPage />}
                    />

                    <Route
                        path="/reports"
                        element={<ComingSoonPage />}
                    />

                    <Route
                        path="/consultations"
                        element={<ComingSoonPage />}
                    />

                    <Route
                        path="/appointments"
                        element={<ComingSoonPage />}
                    />

                    <Route
                        path="/villages"
                        element={<ComingSoonPage />}
                    />


                    {/* =================================================
                        SETTINGS
                    ================================================== */}

                    <Route
                        path="/settings"
                        element={<SettingsPage />}
                    />

                </Route>


                {/* =====================================================
                    FALLBACK
                ====================================================== */}

                <Route
                    path="*"
                    element={
                        <Navigate
                            to="/"
                            replace
                        />
                    }
                />

            </Routes>

        </BrowserRouter>

    );
}