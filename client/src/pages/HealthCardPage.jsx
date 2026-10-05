import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import {
    Download,
    HeartPulse,
    Phone,
    Droplets,
    TriangleAlert,
    MapPin,
    User,
    Loader2,
    ShieldCheck,
    CalendarDays,
    BadgeCheck,
} from "lucide-react";

import api from "../services/api";

export default function HealthCardPage() {
    const { patientId } = useParams();

    const [loading, setLoading] = useState(true);
    const [patient, setPatient] = useState(null);
    const [card, setCard] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let mounted = true;

        async function loadCard() {
            try {
                setLoading(true);
                setError("");

                const url = patientId
                    ? `/health-card/${patientId}`
                    : "/health-card/me";

                const res = await api.get(url);

                if (!mounted) {
                    return;
                }

                setPatient(res.data?.patient || null);
                setCard(res.data?.card || null);
            } catch (err) {
                console.error("Health card error:", err);

                if (mounted) {
                    setError(
                        err.response?.data?.message ||
                        "Unable to load Health Card."
                    );
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        loadCard();

        return () => {
            mounted = false;
        };
    }, [patientId]);

    async function downloadPDF() {
        if (!patient?._id) {
            return;
        }

        try {
            const response = await api.get(
                `/health-card/pdf/${patient._id}`,
                {
                    responseType: "blob",
                }
            );

            const url = window.URL.createObjectURL(response.data);

            const link = document.createElement("a");

            link.href = url;
            link.download = "MedJarvis-HealthCard.pdf";

            document.body.appendChild(link);

            link.click();

            link.remove();

            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);

            alert("Unable to download Health Card PDF.");
        }
    }

    async function downloadQR() {
        if (!patient?._id) {
            return;
        }

        try {
            const response = await api.get(
                `/health-card/qr/${patient._id}`,
                {
                    responseType: "blob",
                }
            );

            const url = window.URL.createObjectURL(response.data);

            const link = document.createElement("a");

            link.href = url;
            link.download = "MedJarvis-QR.png";

            document.body.appendChild(link);

            link.click();

            link.remove();

            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);

            alert("Unable to download QR Code.");
        }
    }

    if (loading) {
        return (
            <div
                className="
                    min-h-[60vh]
                    flex
                    items-center
                    justify-center
                    px-4
                "
            >
                <div className="text-center">
                    <Loader2
                        size={46}
                        className="
                            animate-spin
                            mx-auto
                            text-[#2D6A4F]
                            dark:text-emerald-400
                        "
                    />

                    <p
                        className="
                            mt-5
                            text-[#1A1A1A]
                            dark:text-slate-100
                            font-semibold
                            text-lg
                        "
                    >
                        Loading Health Card...
                    </p>

                    <p
                        className="
                            mt-1
                            text-[#4A4A4A]
                            dark:text-slate-400
                        "
                    >
                        Retrieving your secure health identity.
                    </p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div
                className="
                    max-w-2xl
                    mx-auto
                    px-4
                    py-10
                "
            >
                <div
                    className="
                        bg-[#FFF5F5]
                        dark:bg-red-950/40
                        border
                        border-red-200
                        dark:border-red-900
                        rounded-3xl
                        p-7
                        shadow-sm
                    "
                >
                    <div
                        className="
                            flex
                            items-center
                            gap-3
                            text-red-700
                            dark:text-red-300
                        "
                    >
                        <TriangleAlert size={28} />

                        <h2
                            className="
                                text-xl
                                font-bold
                            "
                        >
                            Health Card Unavailable
                        </h2>
                    </div>

                    <p
                        className="
                            mt-4
                            text-[#1A1A1A]
                            dark:text-slate-200
                            font-medium
                        "
                    >
                        {error}
                    </p>
                </div>
            </div>
        );
    }

    if (!patient || !card) {
        return (
            <div
                className="
                    max-w-2xl
                    mx-auto
                    px-4
                    py-10
                "
            >
                <div
                    className="
                        bg-white
                        dark:bg-slate-900
                        border
                        border-[#E8E0D5]
                        dark:border-slate-800
                        rounded-3xl
                        shadow-sm
                        p-8
                        text-center
                    "
                >
                    <ShieldCheck
                        size={48}
                        className="
                            mx-auto
                            text-[#2D6A4F]
                            dark:text-emerald-400
                        "
                    />

                    <h2
                        className="
                            mt-4
                            text-2xl
                            font-bold
                            text-[#1A1A1A]
                            dark:text-slate-100
                        "
                    >
                        Health Card Not Available
                    </h2>

                    <p
                        className="
                            mt-2
                            text-[#4A4A4A]
                            dark:text-slate-400
                        "
                    >
                        No health card information is currently available.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div
            className="
                w-full
                max-w-6xl
                mx-auto
                space-y-5
                lg:space-y-4
            "
        >
            {/* =====================================================
                PAGE HEADER
            ====================================================== */}

            <div
                className="
                    flex
                    flex-col
                    sm:flex-row
                    sm:items-center
                    sm:justify-between
                    gap-4
                    lg:gap-3
                "
            >
                <div>
                    <div
                        className="
                            inline-flex
                            items-center
                            gap-2
                            px-3
                            py-1
                            rounded-full
                            bg-[#D8F3DC]
                            dark:bg-emerald-950
                            text-[#1B4332]
                            dark:text-emerald-300
                            text-xs
                            sm:text-sm
                            font-bold
                            mb-2
                        "
                    >
                        <BadgeCheck size={15} />

                        Secure Digital Identity
                    </div>

                    <h1
                        className="
                            text-2xl
                            sm:text-3xl
                            lg:text-3xl
                            font-bold
                            text-[#1B4332]
                            dark:text-emerald-400
                        "
                    >
                        My Health Card
                    </h1>

                    <p
                        className="
                            mt-1
                            text-[#1A1A1A]
                            dark:text-slate-300
                            text-sm
                            sm:text-base
                            font-medium
                        "
                    >
                        Your verified MedJarvis healthcare identity.
                    </p>
                </div>

                <ShieldCheck
                    size={44}
                    strokeWidth={1.7}
                    className="text-[#2D6A4F] dark:text-emerald-400"
                />
            </div>

            {/* =====================================================
                CARD
            ====================================================== */}

            <div
                className="
                    bg-white
                    dark:bg-slate-900
                    rounded-[28px]
                    border
                    border-[#E8E0D5]
                    dark:border-slate-800
                    shadow-[0_18px_50px_rgba(45,106,79,0.10)]
                    overflow-hidden
                "
            >
                {/* HEADER */}

                <div
                    className="
                        bg-[#2D6A4F]
                        dark:bg-emerald-800
                        text-white
                        px-5
                        sm:px-7
                        lg:px-7
                        py-5
                        lg:py-4
                    "
                >
                    <div
                        className="
                            flex
                            flex-col
                            sm:flex-row
                            sm:items-center
                            sm:justify-between
                            gap-3
                        "
                    >
                        <div>
                            <p
                                className="
                                    text-[#D8F3DC]
                                    text-xs
                                    font-bold
                                    uppercase
                                    tracking-wider
                                "
                            >
                                MedJarvis
                            </p>

                            <h2
                                className="
                                    text-xl
                                    sm:text-2xl
                                    font-bold
                                    mt-0.5
                                "
                            >
                                Health Card
                            </h2>

                            <p
                                className="
                                    mt-0.5
                                    text-white
                                    text-sm
                                    font-medium
                                    opacity-90
                                "
                            >
                                Secure Digital Patient Identity
                            </p>
                        </div>

                        <div
                            className="
                                self-start
                                sm:self-auto
                                px-3
                                py-1.5
                                rounded-full
                                bg-white/15
                                border
                                border-white/20
                                text-xs
                                sm:text-sm
                                font-bold
                            "
                        >
                            ID: {patient.medJarvisId}
                        </div>
                    </div>
                </div>

                {/* CONTENT */}

                <div
                    className="
                        p-4
                        sm:p-6
                        lg:p-6
                        grid
                        lg:grid-cols-[220px_1fr]
                        gap-6
                        lg:gap-7
                    "
                >
                    {/* QR */}

                    <div
                        className="
                            flex
                            flex-col
                            items-center
                            justify-start
                        "
                    >
                        <div
                            className="
                                bg-[#FAF7F2]
                                dark:bg-slate-800
                                rounded-2xl
                                border
                                border-[#E8E0D5]
                                dark:border-slate-700
                                p-3.5
                                shadow-sm
                            "
                        >
                            <img
                                src={card.qrCode}
                                alt="MedJarvis Health Card QR Code"
                                className="
                                    w-40
                                    h-40
                                    sm:w-44
                                    sm:h-44
                                    lg:w-40
                                    lg:h-40
                                    object-contain
                                    rounded-lg
                                    bg-white
                                    p-1
                                "
                            />
                        </div>

                        <p
                            className="
                                mt-3
                                text-center
                                text-[#1A1A1A]
                                dark:text-slate-100
                                font-semibold
                                text-sm
                            "
                        >
                            Scan to identify patient
                        </p>

                        <p
                            className="
                                mt-0.5
                                text-center
                                text-[#4A4A4A]
                                dark:text-slate-400
                                text-xs
                            "
                        >
                            Secure MedJarvis identification
                        </p>

                        <button
                            onClick={downloadQR}
                            className="
                                mt-3
                                w-full
                                sm:w-auto
                                inline-flex
                                justify-center
                                items-center
                                gap-2
                                bg-[#2D6A4F]
                                hover:bg-[#1B4332]
                                dark:bg-emerald-600
                                dark:hover:bg-emerald-500
                                text-white
                                px-5
                                py-2.5
                                rounded-xl
                                font-bold
                                text-sm
                                shadow-sm
                                hover:shadow-md
                                transition-all
                                duration-200
                            "
                        >
                            <Download size={17} />

                            Download QR
                        </button>
                    </div>

                    {/* DETAILS */}

                    <div>
                        <div
                            className="
                                grid
                                grid-cols-1
                                sm:grid-cols-2
                                gap-2.5
                                lg:gap-3
                            "
                        >
                            <InfoCard
                                icon={<User size={18} />}
                                title="Patient"
                                value={`${patient.firstName} ${patient.lastName}`}
                            />

                            <InfoCard
                                icon={<HeartPulse size={18} />}
                                title="MedJarvis ID"
                                value={patient.medJarvisId}
                            />

                            <InfoCard
                                icon={<Droplets size={18} />}
                                title="Blood Group"
                                value={
                                    patient.bloodGroup ||
                                    "Not available"
                                }
                            />

                            <InfoCard
                                icon={<Phone size={18} />}
                                title="Emergency Contact"
                                value={
                                    patient.emergencyContact ||
                                    "Not available"
                                }
                            />

                            <InfoCard
                                icon={<TriangleAlert size={18} />}
                                title="Allergies"
                                value={
                                    patient.allergies?.length
                                        ? patient.allergies.join(", ")
                                        : "None reported"
                                }
                            />

                            <InfoCard
                                icon={<MapPin size={18} />}
                                title="Location"
                                value={[
                                    patient.village,
                                    patient.district,
                                    patient.state,
                                ]
                                    .filter(Boolean)
                                    .join(", ") ||
                                    "Not available"
                                }
                            />

                            <InfoCard
                                icon={<CalendarDays size={18} />}
                                title="Status"
                                value={patient.status || "Healthy"}
                            />

                            <InfoCard
                                icon={<ShieldCheck size={18} />}
                                title="Card Version"
                                value={`Version ${card.cardVersion ??
                                    patient.healthCardVersion ??
                                    1
                                    }`}
                            />
                        </div>

                        {/* DOWNLOAD */}

                        <div
                            className="
                                mt-4
                                pt-4
                                border-t
                                border-[#E8E0D5]
                                dark:border-slate-800
                                flex
                                flex-col
                                sm:flex-row
                                gap-2.5
                            "
                        >
                            <button
                                onClick={downloadPDF}
                                className="
                                    flex-1
                                    inline-flex
                                    justify-center
                                    items-center
                                    gap-2
                                    bg-[#2D6A4F]
                                    hover:bg-[#1B4332]
                                    dark:bg-emerald-600
                                    dark:hover:bg-emerald-500
                                    text-white
                                    px-5
                                    py-3
                                    rounded-xl
                                    font-bold
                                    text-sm
                                    shadow-sm
                                    hover:shadow-md
                                    transition-all
                                    duration-200
                                "
                            >
                                <Download size={18} />

                                Download Health Card PDF
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ================================================================
   INFO CARD
================================================================ */

function InfoCard({ icon, title, value }) {
    return (
        <div
            className="
                group
                bg-[#FAF7F2]
                dark:bg-slate-800/80
                hover:bg-[#F2EDE4]
                dark:hover:bg-slate-800
                border
                border-[#E8E0D5]
                dark:border-slate-700
                rounded-xl
                p-3.5
                sm:p-4
                transition-all
                duration-200
                hover:-translate-y-0.5
                hover:shadow-md
            "
        >
            <div
                className="
                    flex
                    items-center
                    gap-2
                    text-[#2D6A4F]
                    dark:text-emerald-400
                    font-bold
                    text-sm
                "
            >
                {icon}

                <span>
                    {title}
                </span>
            </div>

            <p
                className="
                    mt-1.5
                    text-[#1A1A1A]
                    dark:text-slate-100
                    font-semibold
                    text-sm
                    sm:text-[15px]
                    leading-5
                    break-words
                "
            >
                {value}
            </p>
        </div>
    );
}