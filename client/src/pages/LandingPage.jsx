import { useNavigate } from "react-router-dom";

import Navbar from "../components/landing/Navbar";
import HeroSection from "../components/landing/HeroSection";
import FeatureSection from "../components/landing/FeatureSection";
import WorkflowSection from "../components/landing/WorkflowSection";
import RolesSection from "../components/landing/RolesSection";
import CTASection from "../components/landing/CTASection";
import FooterSection from "../components/landing/FooterSection";
import FloatingAI from "../components/landing/FloatingAI";
import BackToTop from "../components/landing/BackToTop";
import { useTheme } from "../context/ThemeContext";

export default function LandingPage() {
    const navigate = useNavigate();
    const { isDark } = useTheme();
    const darkMode = isDark;

    return (
        <div
            id="home"
            className={`
                min-h-screen
                transition-colors
                duration-300
                ${
                    darkMode
                        ? "bg-[#0F172A] text-slate-100"
                        : "bg-gradient-to-b from-[#F8FFFB] via-white to-[#F3FFF8] text-gray-900"
                }
            `}
        >
            <Navbar />

            <HeroSection
                darkMode={darkMode}
                navigate={navigate}
            />

            <FeatureSection
                darkMode={darkMode}
            />

            <WorkflowSection
                darkMode={darkMode}
            />

            <RolesSection
                darkMode={darkMode}
            />

            <CTASection
                darkMode={darkMode}
                navigate={navigate}
            />

            <FooterSection
                darkMode={darkMode}
            />

            <FloatingAI />

            <BackToTop />
        </div>
    );
}