import { useState } from "react";
import {
    Search,
    Camera,
    Upload,
    ScanLine,
    Loader2,
    UserSearch,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import CameraScanner from "../components/scan/CameraScanner";
import ImageScanner from "../components/scan/ImageScanner";

export default function ScanPatientPage() {
    const navigate = useNavigate();

    const [medJarvisId, setMedJarvisId] =
        useState("");

    const [loading, setLoading] =
        useState(false);

    const [cameraOpen, setCameraOpen] =
        useState(false);

    const [uploadOpen, setUploadOpen] =
        useState(false);

    async function searchPatient() {
        const id = medJarvisId.trim();

        if (!id) {
            alert("Enter MedJarvis ID");
            return;
        }

        try {
            setLoading(true);

            const res = await api.get(
                `/patients/scan/${encodeURIComponent(id)}`
            );

            const patient = res.data?.data;

            if (!patient?._id) {
                throw new Error(
                    "Patient information not found."
                );
            }

            navigate(
                `/patient-summary/${patient._id}`
            );
        } catch (err) {
            console.error(
                "Patient search error:",
                err
            );

            alert(
                err.response?.data?.message ||
                "Patient not found"
            );
        } finally {
            setLoading(false);
        }
    }

    async function openPatient(id) {
        if (!id) {
            return;
        }

        try {
            const cleanId = String(id).trim();

            if (!cleanId) {
                return;
            }

            const res = await api.get(
                `/patients/scan/${encodeURIComponent(
                    cleanId
                )}`
            );

            const patient = res.data?.data;

            if (!patient?._id) {
                throw new Error(
                    "Patient information not found."
                );
            }

            setCameraOpen(false);
            setUploadOpen(false);

            navigate(
                `/patient-summary/${patient._id}`
            );
        } catch (err) {
            console.error(
                "QR patient lookup error:",
                err
            );

            alert(
                err.response?.data?.message ||
                "Patient not found"
            );
        }
    }

    return (
        <div className="max-w-5xl mx-auto">

            {/* HEADER */}
            <div className="mb-8">

                <div className="flex items-center gap-3">

                    <div className="w-12 h-12 rounded-xl bg-[#D8F3DC] dark:bg-emerald-950 flex items-center justify-center">
                        <UserSearch
                            size={25}
                            className="text-[#2D6A4F] dark:text-emerald-400"
                        />
                    </div>

                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold text-[#2D6A4F] dark:text-emerald-400">
                            Scan Patient
                        </h1>

                        <p className="text-gray-500 dark:text-slate-400 mt-1">
                            Search or scan a MedJarvis patient.
                        </p>
                    </div>

                </div>

            </div>

            <div className="grid lg:grid-cols-3 gap-8">

                {/* SEARCH BY ID */}
                <div className="lg:col-span-1">

                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-lg border border-[#E8E0D5] dark:border-slate-800 p-6 h-full text-slate-900 dark:text-slate-100">

                        <div className="flex items-center gap-3 mb-5">

                            <Search
                                className="text-[#2D6A4F] dark:text-emerald-400"
                                size={28}
                            />

                            <div>
                                <h2 className="font-bold text-xl text-slate-900 dark:text-slate-100">
                                    Search by ID
                                </h2>

                                <p className="text-sm text-gray-500 dark:text-slate-400">
                                    Search using MedJarvis ID
                                </p>
                            </div>

                        </div>

                        <input
                            className="w-full rounded-xl border border-[#E8E0D5] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-4 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
                            placeholder="MJ-KA-DWD-2026-000001"
                            value={medJarvisId}
                            onChange={(e) =>
                                setMedJarvisId(
                                    e.target.value
                                )
                            }
                            onKeyDown={(e) => {
                                if (
                                    e.key === "Enter"
                                ) {
                                    searchPatient();
                                }
                            }}
                        />

                        <button
                            type="button"
                            onClick={searchPatient}
                            disabled={loading}
                            className="mt-5 w-full rounded-xl bg-[#2D6A4F] hover:bg-[#245540] dark:bg-emerald-600 dark:hover:bg-emerald-500 font-bold text-white py-4 flex justify-center items-center gap-2 transition disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <Loader2
                                        size={20}
                                        className="animate-spin"
                                    />
                                    Searching...
                                </>
                            ) : (
                                <>
                                    <Search size={20} />
                                    Search Patient
                                </>
                            )}
                        </button>

                    </div>

                </div>

                {/* CAMERA + IMAGE */}
                <div className="lg:col-span-2 space-y-8">

                    {/* CAMERA */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-lg border border-[#E8E0D5] dark:border-slate-800 p-6 text-slate-900 dark:text-slate-100">

                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">

                            <div className="flex gap-3 items-center">

                                <Camera
                                    className="text-[#2D6A4F] dark:text-emerald-400 shrink-0"
                                    size={30}
                                />

                                <div>
                                    <h2 className="font-bold text-xl text-slate-900 dark:text-slate-100">
                                        Scan QR using Camera
                                    </h2>

                                    <p className="text-gray-500 dark:text-slate-400 text-sm">
                                        Point the camera towards the patient's QR Code.
                                    </p>
                                </div>

                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setCameraOpen(
                                        !cameraOpen
                                    )
                                }
                                className="bg-[#2D6A4F] hover:bg-[#245540] dark:bg-emerald-600 dark:hover:bg-emerald-500 font-bold text-white px-5 py-3 rounded-xl whitespace-nowrap transition"
                            >
                                {cameraOpen
                                    ? "Close Camera"
                                    : "Start Camera"}
                            </button>

                        </div>

                        {cameraOpen && (
                            <div className="mt-6">

                                <CameraScanner
                                    onDetected={
                                        openPatient
                                    }
                                    onClose={() =>
                                        setCameraOpen(
                                            false
                                        )
                                    }
                                />

                            </div>
                        )}

                    </div>

                    {/* IMAGE */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-lg border border-[#E8E0D5] dark:border-slate-800 p-6 text-slate-900 dark:text-slate-100">

                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">

                            <div className="flex gap-3 items-center">

                                <Upload
                                    className="text-[#2D6A4F] dark:text-emerald-400 shrink-0"
                                    size={30}
                                />

                                <div>
                                    <h2 className="font-bold text-xl text-slate-900 dark:text-slate-100">
                                        Upload QR Image
                                    </h2>

                                    <p className="text-gray-500 dark:text-slate-400 text-sm">
                                        PNG / JPG / JPEG
                                    </p>
                                </div>

                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setUploadOpen(
                                        !uploadOpen
                                    )
                                }
                                className="bg-blue-600 hover:bg-blue-700 font-bold text-white px-5 py-3 rounded-xl whitespace-nowrap transition"
                            >
                                {uploadOpen
                                    ? "Hide"
                                    : "Choose Image"}
                            </button>

                        </div>

                        {uploadOpen && (
                            <div className="mt-6">

                                <ImageScanner
                                    onDetected={
                                        openPatient
                                    }
                                />

                            </div>
                        )}

                    </div>

                </div>

            </div>

            {/* SUPPORTED METHODS */}
            <div className="mt-10 bg-[#F7FAF8] dark:bg-slate-900 border border-[#E8E0D5] dark:border-slate-800 rounded-3xl p-6 text-slate-900 dark:text-slate-100">

                <div className="flex gap-3 items-center">

                    <ScanLine
                        className="text-[#2D6A4F] dark:text-emerald-400"
                        size={28}
                    />

                    <div>
                        <h2 className="font-bold text-xl text-slate-900 dark:text-slate-100">
                            Supported Lookup Methods
                        </h2>

                        <p className="text-gray-500 dark:text-slate-400">
                            Multiple ways to quickly locate a patient.
                        </p>
                    </div>

                </div>

                <div className="grid md:grid-cols-3 gap-5 mt-6">

                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-[#E8E0D5] dark:border-slate-700">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                            Search by ID
                        </h3>

                        <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
                            Enter the MedJarvis ID manually.
                        </p>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-[#E8E0D5] dark:border-slate-700">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                            Camera Scan
                        </h3>

                        <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
                            Scan QR directly using your webcam.
                        </p>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-[#E8E0D5] dark:border-slate-700">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                            Upload QR
                        </h3>

                        <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
                            Decode a QR image from your computer.
                        </p>
                    </div>

                </div>

            </div>

        </div>
    );
}