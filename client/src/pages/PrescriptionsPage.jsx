import { useEffect, useState } from "react";
import {
    AlertCircle,
    CalendarDays,
    FileText,
    Loader2,
    Pill,
    RefreshCw,
    Stethoscope,
} from "lucide-react";

import api from "../services/api";


export default function PrescriptionsPage() {

    const [prescription, setPrescription] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");


    function getPatientId() {

        const profile = JSON.parse(
            localStorage.getItem("profile") || "{}"
        );

        if (
            profile?.patient &&
            typeof profile.patient === "object"
        ) {
            return profile.patient?._id || null;
        }

        return profile?.patient || profile?.patientId || null;
    }


    async function loadPrescription() {

        const patientId = getPatientId();

        if (!patientId) {

            setError(
                "No patient profile is linked to this account."
            );

            setLoading(false);

            return;
        }


        try {

            setLoading(true);
            setError("");

            /*
             * This endpoint already exists in the current
             * PatientSummaryPage implementation.
             */
            const response = await api.get(
                `/prescriptions/latest/${patientId}`
            );

            setPrescription(
                response.data?.data || null
            );

        } catch (err) {

            console.error(
                "Prescription loading error:",
                err
            );

            if (err.response?.status === 404) {

                setPrescription(null);

                setError("");

            } else {

                setError(
                    err.response?.data?.message ||
                    "Unable to load prescription."
                );

            }

        } finally {

            setLoading(false);

        }

    }


    useEffect(() => {

        loadPrescription();

    }, []);


    if (loading) {

        return (
            <div
                className="
                    min-h-[55vh]
                    flex
                    items-center
                    justify-center
                "
            >

                <div className="text-center">

                    <Loader2
                        size={44}
                        className="
                            mx-auto
                            animate-spin
                            text-[#2D6A4F]
                            dark:text-emerald-400
                        "
                    />

                    <p
                        className="
                            mt-4
                            text-slate-900
                            dark:text-slate-100
                            font-bold
                        "
                    >
                        Loading Prescriptions...
                    </p>

                </div>

            </div>
        );

    }


    return (
        <div
            className="
                max-w-5xl
                mx-auto
                space-y-7
            "
        >

            {/* HEADER */}

            <div
                className="
                    flex
                    flex-col
                    sm:flex-row
                    sm:items-center
                    sm:justify-between
                    gap-4
                "
            >

                <div>

                    <div
                        className="
                            inline-flex
                            items-center
                            gap-2
                            px-3
                            py-1.5
                            rounded-full
                            bg-[#D8F3DC]
                            dark:bg-emerald-950
                            text-[#1B4332]
                            dark:text-emerald-300
                            text-sm
                            font-bold
                            mb-3
                        "
                    >

                        <Pill size={16} />

                        Medication Records

                    </div>

                    <h1
                        className="
                            text-3xl
                            sm:text-4xl
                            font-bold
                            text-[#1B4332]
                            dark:text-emerald-400
                        "
                    >
                        Prescriptions
                    </h1>

                    <p
                        className="
                            mt-2
                            text-slate-700
                            dark:text-slate-300
                            font-medium
                        "
                    >
                        View your latest recorded prescription.
                    </p>

                </div>


                <button
                    onClick={loadPrescription}
                    className="
                        inline-flex
                        items-center
                        justify-center
                        gap-2
                        px-5
                        py-3
                        rounded-xl
                        border
                        border-[#E8E0D5]
                        dark:border-slate-700
                        bg-white
                        dark:bg-slate-800
                        text-slate-900
                        dark:text-slate-100
                        font-bold
                        hover:bg-[#FAF7F2]
                        dark:hover:bg-slate-700
                        transition
                    "
                >

                    <RefreshCw size={18} />

                    Refresh

                </button>

            </div>


            {/* ERROR */}

            {error && (

                <div
                    className="
                        rounded-2xl
                        border
                        border-red-200
                        dark:border-red-900
                        bg-red-50
                        dark:bg-red-950/50
                        p-5
                    "
                >

                    <div
                        className="
                            flex
                            gap-3
                            items-start
                            text-red-700
                            dark:text-red-300
                        "
                    >

                        <AlertCircle
                            size={23}
                            className="mt-0.5"
                        />

                        <div>

                            <h2 className="font-bold">
                                Prescription Unavailable
                            </h2>

                            <p
                                className="
                                    mt-1
                                    text-slate-800
                                    dark:text-slate-200
                                    font-medium
                                "
                            >
                                {error}
                            </p>

                        </div>

                    </div>

                </div>

            )}


            {/* EMPTY */}

            {!error && !prescription && (

                <div
                    className="
                        bg-white
                        dark:bg-slate-900
                        border
                        border-[#E8E0D5]
                        dark:border-slate-800
                        rounded-3xl
                        shadow-sm
                        p-10
                        text-center
                    "
                >

                    <div
                        className="
                            w-16
                            h-16
                            mx-auto
                            rounded-2xl
                            bg-[#D8F3DC]
                            dark:bg-emerald-950
                            flex
                            items-center
                            justify-center
                        "
                    >

                        <FileText
                            size={30}
                            className="text-[#2D6A4F] dark:text-emerald-400"
                        />

                    </div>

                    <h2
                        className="
                            mt-5
                            text-2xl
                            font-bold
                            text-slate-900
                            dark:text-slate-100
                        "
                    >
                        No Prescription Recorded
                    </h2>

                    <p
                        className="
                            mt-2
                            text-slate-600
                            dark:text-slate-400
                            font-medium
                        "
                    >
                        No prescription has been recorded for this patient yet.
                    </p>

                </div>

            )}


            {/* PRESCRIPTION */}

            {prescription && (

                <div
                    className="
                        bg-white
                        dark:bg-slate-900
                        border
                        border-[#E8E0D5]
                        dark:border-slate-800
                        rounded-3xl
                        shadow-sm
                        overflow-hidden
                    "
                >

                    {/* TITLE */}

                    <div
                        className="
                            bg-[#2D6A4F]
                            dark:bg-emerald-800
                            text-white
                            p-6
                            sm:p-8
                        "
                    >

                        <div
                            className="
                                flex
                                items-center
                                gap-3
                            "
                        >

                            <div
                                className="
                                    w-12
                                    h-12
                                    rounded-xl
                                    bg-white/15
                                    flex
                                    items-center
                                    justify-center
                                "
                            >

                                <FileText size={25} />

                            </div>

                            <div>

                                <h2
                                    className="
                                        text-2xl
                                        font-bold
                                    "
                                >
                                    Prescription
                                </h2>

                                <p
                                    className="
                                        text-white/85
                                        text-sm
                                        mt-1
                                    "
                                >
                                    MedJarvis medical record
                                </p>

                            </div>

                        </div>

                    </div>


                    <div className="p-6 sm:p-8">

                        {/* DOCTOR / DIAGNOSIS */}

                        <div
                            className="
                                grid
                                grid-cols-1
                                md:grid-cols-2
                                gap-4
                            "
                        >

                            <InfoCard
                                icon={<Stethoscope size={20} />}
                                title="Doctor"
                                value={
                                    prescription.doctor?.displayName ||
                                    prescription.doctor?.name ||
                                    "Not available"
                                }
                            />

                            <InfoCard
                                icon={<FileText size={20} />}
                                title="Diagnosis"
                                value={
                                    prescription.diagnosis ||
                                    "Not recorded"
                                }
                            />

                            <InfoCard
                                icon={<CalendarDays size={20} />}
                                title="Date"
                                value={
                                    prescription.createdAt
                                        ? new Date(
                                            prescription.createdAt
                                        ).toLocaleDateString("en-IN", {
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric",
                                        })
                                        : "Not available"
                                }
                            />

                            <InfoCard
                                icon={<FileText size={20} />}
                                title="Status"
                                value={
                                    prescription.status ||
                                    "Recorded"
                                }
                            />

                        </div>


                        {/* MEDICINES */}

                        <div className="mt-8">

                            <h3
                                className="
                                    text-xl
                                    font-bold
                                    text-slate-900
                                    dark:text-slate-100
                                    flex
                                    items-center
                                    gap-2
                                "
                            >

                                <Pill
                                    size={22}
                                    className="text-[#2D6A4F] dark:text-emerald-400"
                                />

                                Medicines

                            </h3>


                            {Array.isArray(
                                prescription.medicines
                            ) &&
                                prescription.medicines.length > 0 ? (

                                <div
                                    className="
                                        mt-4
                                        space-y-4
                                    "
                                >

                                    {prescription.medicines.map(
                                        (medicine, index) => (

                                            <div
                                                key={index}
                                                className="
                                                    rounded-2xl
                                                    border
                                                    border-[#E8E0D5]
                                                    dark:border-slate-700
                                                    bg-[#FAF7F2]
                                                    dark:bg-slate-800/80
                                                    p-5
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

                                                        <h4
                                                            className="
                                                                text-lg
                                                                font-bold
                                                                text-slate-900
                                                                dark:text-slate-100
                                                            "
                                                        >
                                                            {
                                                                medicine.medicineName ||
                                                                medicine.name ||
                                                                "Medicine"
                                                            }
                                                        </h4>

                                                        {medicine.dosage && (

                                                            <p
                                                                className="
                                                                    mt-1
                                                                    text-slate-600
                                                                    dark:text-slate-400
                                                                    font-medium
                                                                "
                                                            >
                                                                Dosage:{" "}
                                                                {medicine.dosage}
                                                            </p>

                                                        )}

                                                    </div>

                                                </div>


                                                <div
                                                    className="
                                                        mt-4
                                                        grid
                                                        grid-cols-1
                                                        sm:grid-cols-2
                                                        lg:grid-cols-3
                                                        gap-3
                                                    "
                                                >

                                                    <SmallField
                                                        label="Frequency"
                                                        value={
                                                            medicine.frequency
                                                        }
                                                    />

                                                    <SmallField
                                                        label="Duration"
                                                        value={
                                                            medicine.duration
                                                        }
                                                    />

                                                    <SmallField
                                                        label="Instructions"
                                                        value={
                                                            medicine.instructions
                                                        }
                                                    />

                                                </div>

                                            </div>

                                        )
                                    )}

                                </div>

                            ) : (

                                <div
                                    className="
                                        mt-4
                                        rounded-2xl
                                        border
                                        border-dashed
                                        border-[#E8E0D5]
                                        dark:border-slate-700
                                        p-6
                                        text-center
                                        text-slate-600
                                        dark:text-slate-400
                                    "
                                >
                                    No medicine details recorded.
                                </div>

                            )}

                        </div>

                    </div>

                </div>

            )}


            {/* SAFETY */}

            <div
                className="
                    rounded-2xl
                    border
                    border-[#E8E0D5]
                    dark:border-amber-900/50
                    bg-[#FFF8F1]
                    dark:bg-amber-950/30
                    p-5
                    text-sm
                    text-slate-700
                    dark:text-amber-200
                    font-medium
                    leading-6
                "
            >
                Medication information shown here is for record/reference
                purposes. Follow the instructions of the prescribing healthcare
                professional and do not change medication without professional
                advice.
            </div>

        </div>
    );
}


function InfoCard({
    icon,
    title,
    value,
}) {

    return (
        <div
            className="
                rounded-2xl
                border
                border-[#E8E0D5]
                dark:border-slate-700
                bg-[#FAF7F2]
                dark:bg-slate-800/80
                p-5
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
                "
            >

                {icon}

                {title}

            </div>

            <p
                className="
                    mt-3
                    text-slate-900
                    dark:text-slate-100
                    font-semibold
                "
            >
                {value}
            </p>

        </div>
    );
}


function SmallField({
    label,
    value,
}) {

    return (
        <div
            className="
                rounded-xl
                bg-white
                dark:bg-slate-900
                border
                border-[#E8E0D5]
                dark:border-slate-800
                p-3
            "
        >

            <p
                className="
                    text-xs
                    text-slate-500
                    dark:text-slate-400
                    font-bold
                    uppercase
                "
            >
                {label}
            </p>

            <p
                className="
                    mt-1
                    text-slate-900
                    dark:text-slate-100
                    font-semibold
                "
            >
                {value || "Not specified"}
            </p>

        </div>
    );
}