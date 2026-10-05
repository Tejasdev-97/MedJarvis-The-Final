import VitalReading from "../models/VitalReading.js";
import Patient from "../models/Patient.js";
import Band from "../models/Band.js";
import MonitoringSession from "../models/MonitoringSession.js";
import Profile from "../models/Profile.js";

// ============================================================
// PATIENT ACCESS RESOLUTION
//
// Patient users may only access the patient linked to their
// authenticated profile.
//
// Staff roles retain the ability to request a patientId.
// ============================================================

async function resolveRequestedPatientId(req) {
    if (req.user?.role !== "Patient") {
        return req.params.patientId;
    }

    const profile = await Profile.findById(
        req.user.profileId
    ).select("patient");

    if (!profile?.patient) {
        return null;
    }

    return String(profile.patient);
}

export const createVitalReading = async (req, res) => {
    try {
        const {
            bandId,
            spo2,
            heartRate,
            hrvSDNN,
            measurementConfidence,
            spo2Confidence,
            heartRateConfidence,
            hrvConfidence,
            temperature,
            tilt,
            signalQuality,
            accelMagnitude,
            gyroMagnitude,
            accelX,
            accelY,
            accelZ,
            gyroX,
            gyroY,
            gyroZ,
            ir,
            red,
            measurementDuration,
            maxSamples,
            spo2WindowSamples,
            mpuSamples,
            validatedBeats,
            validatedRRIntervals,
            validHRWindows,
            validSpO2Windows,
            wifiConnected,
            mode,
            fallDetected,
            ppgWaveform,
        } = req.body;

        if (!bandId) {
            return res.status(400).json({
                success: false,
                message: "bandId is required",
            });
        }

        const band = await Band.findOne({
            bandId,
            isActive: true,
        });

        if (!band) {
            return res.status(404).json({
                success: false,
                message: "Band not found",
            });
        }

        const session =
            await MonitoringSession.findOne({
                band: band._id,
                status: "active",
            }).populate("patient");

        if (!session || !session.patient) {
            return res.status(409).json({
                success: false,
                message:
                    "No active monitoring session for this band",
            });
        }

        const patient = session.patient;

        const vital = await VitalReading.create({
            patient: patient._id,
            band: band._id,
            session: session._id,
            spo2,
            heartRate,
            hrvSDNN,
            measurementConfidence,
            spo2Confidence,
            heartRateConfidence,
            hrvConfidence,
            temperature,
            tilt,
            signalQuality,
            accelMagnitude,
            gyroMagnitude,
            accelX,
            accelY,
            accelZ,
            gyroX,
            gyroY,
            gyroZ,
            ir,
            red,
            measurementDuration,
            maxSamples,
            spo2WindowSamples,
            mpuSamples,
            validatedBeats,
            validatedRRIntervals,
            validHRWindows,
            validSpO2Windows,
            wifiConnected,
            mode: mode || session.mode,
            fallDetected: fallDetected === true,
            source: "ESP32",
            recordedByProfile: req.user?.profileId || null,
            recordedByRole: req.user?.role
                ? req.user.role === "Doctor"
                    ? "DOCTOR"
                    : req.user.role === "Health Worker"
                    ? "HEALTH_WORKER"
                    : req.user.role === "Patient"
                    ? "PATIENT"
                    : "OTHER"
                : "PATIENT",
            measurementSource: "ESP32_BAND",
            measurementContext: req.user?.role === "Doctor"
                ? "CLINICAL_MONITORING"
                : req.user?.role === "Health Worker"
                ? "FIELD_VISIT"
                : "SELF_MONITORING",
        });

        const io = req.app.get("io");

        if (io) {
            const liveVital = vital.toObject
                ? vital.toObject()
                : { ...vital };

            /*
             * PPG waveform is intentionally NOT stored in MongoDB.
             * It is only forwarded live through Socket.IO.
             *
             * ESP32 currently sends up to 256 samples.
             * Keep the full 256-sample window instead of
             * truncating it to a smaller packet.
             */
            if (
                Array.isArray(ppgWaveform) &&
                ppgWaveform.length > 1
            ) {
                const sanitizedWaveform =
                    ppgWaveform
                        .map(Number)
                        .filter(Number.isFinite)
                        .slice(-256);

                if (
                    sanitizedWaveform.length > 1
                ) {
                    liveVital.ppgWaveform =
                        sanitizedWaveform;
                }
            }

            /*
             * Forward confirmed beat positions so the frontend
             * can mark real validated heart beats on the PPG
             * waveform.
             */
            if (
                Array.isArray(req.body.ppgBeatPositions) &&
                req.body.ppgBeatPositions.length > 0
            ) {
                const waveformLength =
                    Array.isArray(liveVital.ppgWaveform)
                        ? liveVital.ppgWaveform.length
                        : 0;

                const sanitizedBeatPositions =
                    req.body.ppgBeatPositions
                        .map(Number)
                        .filter(
                            (position) =>
                                Number.isInteger(position) &&
                                position >= 0 &&
                                position < waveformLength
                        )
                        .slice(-16);

                if (
                    sanitizedBeatPositions.length > 0
                ) {
                    liveVital.ppgBeatPositions =
                        sanitizedBeatPositions;
                }
            }

            io.to(
                `patient_${patient._id}`
            ).emit(
                "newVital",
                liveVital
            );

            // ========================================================
            // FALL ALERT — two paths can trigger this:
            //
            //  PATH 1 (Hardware-confirmed): ESP32 state machine completed
            //          all 3 phases (impact → orientation change → stillness)
            //          and sent fallDetected: true in the payload.
            //
            //  PATH 2 (Backend-side instant detection): accelMagnitude
            //          crosses the same impact threshold (≥ 22 m/s²) that
            //          the hardware uses as the entry to its fall state
            //          machine. This fires immediately on ANY reading with
            //          high acceleration — it works even in SPOT mode, even
            //          if the user picks the sensor up before the 1800 ms
            //          stillness window expires on the hardware.
            //
            //  A per-patient cooldown of 10 s prevents duplicate alerts.
            // ========================================================

            // Server-side cooldown map (module-level singleton)
            if (!createVitalReading._fallCooldown) {
                createVitalReading._fallCooldown = new Map();
            }

            const patientKey = String(patient._id);
            const now = Date.now();
            const lastAlert =
                createVitalReading._fallCooldown.get(patientKey) || 0;
            const FALL_COOLDOWN_MS = 10000; // 10 s
            const onCooldown = now - lastAlert < FALL_COOLDOWN_MS;

            // PATH 1 — hardware confirmed fall
            const hardwareFall = fallDetected === true;

            // PATH 2 — backend detects high-impact reading directly
            // Threshold: 22 m/s² (≈ 2.24 g) — matches FALL_IMPACT_ACCEL_THRESHOLD
            const BACKEND_FALL_ACCEL_THRESHOLD = 22.0;
            const backendFall =
                typeof accelMagnitude === "number" &&
                isFinite(accelMagnitude) &&
                accelMagnitude >= BACKEND_FALL_ACCEL_THRESHOLD;

            const shouldEmitFall =
                (hardwareFall || backendFall) && !onCooldown;

            if (shouldEmitFall) {
                createVitalReading._fallCooldown.set(patientKey, now);

                const detectionPath = hardwareFall
                    ? "hardware-confirmed"
                    : "backend-accel-threshold";

                io.to(
                    `patient_${patient._id}`
                ).emit("fallAlert", {
                    patientId: patientKey,
                    bandId: band.bandId,
                    sessionId: session._id,
                    accelMagnitude: accelMagnitude ?? null,
                    gyroMagnitude: gyroMagnitude ?? null,
                    tilt: tilt ?? null,
                    spo2: spo2 ?? null,
                    heartRate: heartRate ?? null,
                    temperature: temperature ?? null,
                    fallEventConfidence:
                        req.body.fallEventConfidence ??
                        (backendFall && !hardwareFall
                            ? Math.min(
                                  55 +
                                      Math.round(
                                          ((accelMagnitude - 22) / 58) * 40
                                      ),
                                  95
                              )
                            : null),
                    detectedBy: detectionPath,
                    timestamp: new Date().toISOString(),
                });

                console.log(
                    `🚨 FALL ALERT [${detectionPath}] emitted to patient room: ${patientKey}` +
                        (backendFall
                            ? ` | accelMagnitude=${accelMagnitude?.toFixed(2)}`
                            : "")
                );
            }
        }

        return res.status(201).json({
            success: true,
            message:
                "Vital reading saved successfully",
            data: vital,
        });
    } catch (error) {
        console.error(
            "CREATE VITAL ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to save vital reading",
        });
    }
};

export const updateSensorStatus = async (
    req,
    res
) => {
    try {
        const {
            bandId,
            status,
            message,
            remainingSeconds,
            mode,
        } = req.body;

        if (!bandId) {
            return res.status(400).json({
                success: false,
                message: "bandId is required",
            });
        }

        const allowedStatuses = [
            "STARTING",
            "SENSOR_READY",
            "WAITING_FOR_FINGER",
            "FINGER_DETECTED",
            "STABILIZING",
            "SIGNAL_STABLE",
            "MEASURING",
            "READING_COMPLETE",
            "FINGER_REMOVED",
            "SESSION_COMPLETE",
            "STOPPING",
            "SESSION_STOPPED",
            "SENSOR_ERROR",
            "COMMUNICATION_ERROR",
        ];

        if (!status) {
            return res.status(400).json({
                success: false,
                message: "status is required",
            });
        }

        if (
            !allowedStatuses.includes(status)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid sensor status",
            });
        }

        const band = await Band.findOne({
            bandId,
            isActive: true,
        });

        if (!band) {
            return res.status(404).json({
                success: false,
                message: "Band not found",
            });
        }

        const session =
            await MonitoringSession.findOne({
                band: band._id,
                status: "active",
            }).populate("patient");

        if (
            !session ||
            !session.patient
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "No active monitoring session for this band",
            });
        }

        const patient =
            session.patient;

        let normalizedRemainingSeconds =
            null;

        if (
            remainingSeconds !==
            undefined &&
            remainingSeconds !== null &&
            remainingSeconds !== ""
        ) {
            const parsedSeconds =
                Number(
                    remainingSeconds
                );

            if (
                Number.isFinite(
                    parsedSeconds
                ) &&
                parsedSeconds >= 0
            ) {
                normalizedRemainingSeconds =
                    Math.floor(
                        parsedSeconds
                    );
            }
        }

        const sensorStatus = {
            bandId: band.bandId,
            patientId:
                patient._id,
            sessionId:
                session._id,
            mode:
                mode ||
                session.mode,
            status,
            message:
                message ||
                "Sensor status updated.",
            remainingSeconds:
                normalizedRemainingSeconds,
            timestamp:
                new Date().toISOString(),
        };

        const io =
            req.app.get("io");

        if (io) {
            io.to(
                `patient_${patient._id}`
            ).emit(
                "sensorStatus",
                sensorStatus
            );
        }

        return res.status(200).json({
            success: true,
            message:
                "Sensor status received",
            data: sensorStatus,
        });
    } catch (error) {
        console.error(
            "UPDATE SENSOR STATUS ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to update sensor status",
        });
    }
};

export const getLatestVital = async (
    req,
    res
) => {
    try {
        const patientId =
            await resolveRequestedPatientId(req);

        if (!patientId) {
            return res.status(404).json({
                success: false,
                message:
                    "Patient profile is not linked to a patient record.",
            });
        }

        const vital =
            await VitalReading.findOne({
                patient: patientId,
            }).sort({
                createdAt: -1,
            });

        if (!vital) {
            return res.status(404).json({
                success: false,
                message:
                    "No vital readings found",
            });
        }

        return res.json({
            success: true,
            data: vital,
        });
    } catch (error) {
        console.error(
            "GET LATEST VITAL ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to get vital reading",
        });
    }
};

export const getPatientVitals = async (
    req,
    res
) => {
    try {
        const patientId =
            await resolveRequestedPatientId(req);

        if (!patientId) {
            return res.status(404).json({
                success: false,
                message:
                    "Patient profile is not linked to a patient record.",
            });
        }

        const vitals =
            await VitalReading.find({
                patient: patientId,
            })
                .sort({
                    createdAt: -1,
                })
                .limit(50);

        return res.json({
            success: true,
            count: vitals.length,
            data: vitals,
        });
    } catch (error) {
        console.error(
            "GET VITAL HISTORY ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to get vital history",
        });
    }
};

export const startMonitoring = async (
    req,
    res
) => {
    try {
        const {
            bandId,
            mode,
        } = req.body;

        if (!bandId) {
            return res.status(400).json({
                success: false,
                message:
                    "bandId is required",
            });
        }

        if (
            ![
                "spot",
                "continuous",
            ].includes(mode)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Mode must be spot or continuous",
            });
        }

        const band =
            await Band.findOne({
                bandId,
                isActive: true,
            });

        if (!band) {
            return res.status(404).json({
                success: false,
                message:
                    "Band not found",
            });
        }

        const existingSession =
            await MonitoringSession.findOne({
                band: band._id,
                status: "active",
            });

        if (existingSession) {
            return res.status(409).json({
                success: false,
                message:
                    "This band is currently in use",
            });
        }

        const profile =
            await Profile.findById(
                req.user.profileId
            );

        if (!profile) {
            return res.status(404).json({
                success: false,
                message:
                    "Profile not found",
            });
        }

        if (!profile.patient) {
            return res.status(400).json({
                success: false,
                message:
                    "This profile is not linked to a patient",
            });
        }

        const patient =
            await Patient.findOne({
                _id: profile.patient,
                isDeleted: {
                    $ne: true,
                },
            });

        if (!patient) {
            return res.status(404).json({
                success: false,
                message:
                    "Patient not found",
            });
        }

        const session =
            await MonitoringSession.create({
                band: band._id,
                patient: patient._id,
                mode,
                status: "active",
                startedAt:
                    new Date(),
                createdBy:
                    profile._id,
            });

        band.status =
            "In Use";

        await band.save();

        return res.status(201).json({
            success: true,
            message:
                `${mode} monitoring started`,
            data: {
                sessionId:
                    session._id,
                bandId:
                    band.bandId,
                patientId:
                    patient._id,
                mode:
                    session.mode,
                active: true,
            },
        });
    } catch (error) {
        console.error(
            "START MONITORING ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to start monitoring",
        });
    }
};

export const stopMonitoring = async (
    req,
    res
) => {
    try {
        const {
            bandId,
        } = req.body;

        if (!bandId) {
            return res.status(400).json({
                success: false,
                message:
                    "bandId is required",
            });
        }

        const band =
            await Band.findOne({
                bandId,
                isActive: true,
            });

        if (!band) {
            return res.status(404).json({
                success: false,
                message:
                    "Band not found",
            });
        }

        const session =
            await MonitoringSession.findOne({
                band: band._id,
                status: "active",
            });

        if (!session) {
            return res.json({
                success: true,
                message:
                    "No active monitoring session",
            });
        }

        session.status =
            "stopped";

        session.endedAt =
            new Date();

        await session.save();

        band.status =
            "Available";

        await band.save();

        const io =
            req.app.get("io");

        if (io) {
            io.to(
                `patient_${session.patient}`
            ).emit(
                "monitoringState",
                {
                    bandId:
                        band.bandId,
                    sessionId:
                        session._id,
                    patientId:
                        session.patient,
                    active: false,
                    mode:
                        session.mode,
                    state:
                        "STOPPED",
                    timestamp:
                        new Date().toISOString(),
                }
            );
        }

        return res.json({
            success: true,
            message:
                "Monitoring stopped",
            data: {
                sessionId:
                    session._id,
                bandId:
                    band.bandId,
                active: false,
            },
        });
    } catch (error) {
        console.error(
            "STOP MONITORING ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to stop monitoring",
        });
    }
};

export const getMonitoringControl = async (
    req,
    res
) => {
    try {
        const {
            bandId,
        } = req.params;

        const band =
            await Band.findOne({
                bandId,
                isActive: true,
            });

        if (!band) {
            return res.status(404).json({
                success: false,
                message:
                    "Band not found",
            });
        }

        const session =
            await MonitoringSession.findOne({
                band: band._id,
                status: "active",
            });

        if (!session) {
            return res.json({
                success: true,
                active: false,
                mode: null,
                sessionId: null,
            });
        }

        return res.json({
            success: true,
            active: true,
            mode:
                session.mode,
            sessionId:
                session._id,
            patientId:
                session.patient,
        });
    } catch (error) {
        console.error(
            "GET MONITORING CONTROL ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to get monitoring control",
        });
    }
};

export const completeMonitoring = async (
    req,
    res
) => {
    try {
        const {
            bandId,
        } = req.params;

        const band =
            await Band.findOne({
                bandId,
                isActive: true,
            });

        if (!band) {
            return res.status(404).json({
                success: false,
                message:
                    "Band not found",
            });
        }

        const session =
            await MonitoringSession.findOne({
                band: band._id,
                status: "active",
            });

        if (!session) {
            return res.json({
                success: true,
                message:
                    "No active monitoring session",
            });
        }

        session.status =
            "completed";

        session.endedAt =
            new Date();

        await session.save();

        band.status =
            "Available";

        await band.save();

        const io =
            req.app.get("io");

        if (io) {
            io.to(
                `patient_${session.patient}`
            ).emit(
                "monitoringState",
                {
                    bandId:
                        band.bandId,
                    sessionId:
                        session._id,
                    patientId:
                        session.patient,
                    active: false,
                    mode:
                        session.mode,
                    state:
                        "COMPLETED",
                    timestamp:
                        new Date().toISOString(),
                }
            );
        }

        return res.json({
            success: true,
            message:
                "Monitoring completed",
            data: {
                sessionId:
                    session._id,
                bandId:
                    band.bandId,
                active: false,
            },
        });
    } catch (error) {
        console.error(
            "COMPLETE MONITORING ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to complete monitoring",
        });
    }
};