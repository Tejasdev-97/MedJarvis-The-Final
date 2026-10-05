import EmergencyEvent from "../models/EmergencyEvent.js";
import Band from "../models/Band.js";
import MonitoringSession from "../models/MonitoringSession.js";

// ============================================================
// CREATE EMERGENCY EVENT
// ESP32 → fallAlert socket → Frontend declares → POST here
// ============================================================

export const createEmergencyEvent = async (req, res) => {
    try {
        const {
            bandId,
            type = "fall",
            severity = "HIGH",
            spo2,
            heartRate,
            temperature,
            accelMagnitude,
            gyroMagnitude,
            tilt,
            fallEventConfidence,
            latitude,
            longitude,
        } = req.body;

        // ========================================================
        // BAND ID REQUIRED
        // ========================================================

        if (!bandId) {
            return res.status(400).json({
                success: false,
                message: "bandId is required",
            });
        }

        // ========================================================
        // FIND BAND
        // ========================================================

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

        // ========================================================
        // FIND ACTIVE MONITORING SESSION
        // BAND → SESSION → PATIENT
        // ========================================================

        const session = await MonitoringSession.findOne({
            band: band._id,
            status: "active",
        }).populate("patient");

        if (!session || !session.patient) {
            return res.status(409).json({
                success: false,
                message:
                    "No active monitoring session found for this band",
            });
        }

        const patient = session.patient;

        // ========================================================
        // EMERGENCY CONTACT
        // ========================================================

        const phone = patient.emergencyContact;

        if (!phone) {
            return res.status(400).json({
                success: false,
                message: "Emergency contact is missing",
            });
        }

        // ========================================================
        // DUPLICATE PROTECTION
        // Do NOT create a new event if there is already an active
        // emergency for this session. One session = one notification cycle.
        // ========================================================

        const existingActive = await EmergencyEvent.findOne({
            session: session._id,
            status: { $in: ["declared", "active", "alert_sent"] },
        });

        if (existingActive) {
            return res.status(200).json({
                success: true,
                message: "Emergency already active for this session",
                data: { event: existingActive, duplicate: true },
            });
        }

        // ========================================================
        // SMS MESSAGE
        // ========================================================

        const patientName =
            `${patient.firstName} ${patient.lastName}`.trim();

        const detectionTime = new Date().toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
        });

        const message =
            `MEDJARVIS EMERGENCY\n\n` +
            `Patient: ${patientName}\n` +
            `Possible fall/emergency detected.\n` +
            `Time: ${detectionTime}\n` +
            `MedJarvis ID: ${patient.medJarvisId}\n\n` +
            `Please check immediately.\n\n` +
            `— MedJarvis`;

        // ========================================================
        // CREATE EMERGENCY EVENT
        // ========================================================

        const event = await EmergencyEvent.create({
            patient: patient._id,
            band: band._id,
            session: session._id,
            type,
            severity,
            status: "declared",
            declaredAt: new Date(),
            message,
            spo2: spo2 || null,
            heartRate: heartRate || null,
            temperature: temperature || null,
            accelMagnitude: accelMagnitude || null,
            gyroMagnitude: gyroMagnitude || null,
            tilt: tilt || null,
            fallEventConfidence: fallEventConfidence || null,
            latitude: latitude || null,
            longitude: longitude || null,
        });

        // ========================================================
        // SEND SMS VIA FAST2SMS
        // ========================================================

        if (!process.env.FAST2SMS_API_KEY) {
            event.status = "active";
            event.smsStatus = "failed";
            await event.save();

            return res.status(201).json({
                success: true,
                message: "Emergency event created (SMS skipped — no API key)",
                data: {
                    event,
                    patient: {
                        name: patientName,
                        age: patient.age,
                        medJarvisId: patient.medJarvisId,
                        phone: patient.phone,
                        emergencyContact: phone,
                        photo: patient.photo || "",
                    },
                    smsStatus: "failed",
                    callStatus: "not_initiated",
                },
            });
        }

        let smsSuccess = false;
        let smsData = null;

        try {
            const smsResponse = await fetch(
                "https://www.fast2sms.com/dev/bulkV2",
                {
                    method: "POST",
                    headers: {
                        Authorization: process.env.FAST2SMS_API_KEY,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        route: "q",
                        message,
                        numbers: phone,
                        sms_details: "1",
                    }),
                }
            );

            smsData = await smsResponse.json();

            console.log("Fast2SMS emergency response:", smsData);

            smsSuccess =
                smsResponse.ok && smsData.return !== false;

        } catch (smsErr) {
            console.error("SMS send error:", smsErr.message);
            smsSuccess = false;
        }

        // ========================================================
        // UPDATE EVENT STATUS AFTER SMS
        // ========================================================

        event.status = "active";

        if (smsSuccess) {
            event.smsStatus = "accepted";
            event.smsRequestId = smsData?.request_id || "";
        } else {
            event.smsStatus = "failed";
        }

        await event.save();

        // ========================================================
        // CALL — use tel: link on mobile; for backend, mark initiated
        // The actual dialling is done by the frontend using window.open("tel:...")
        // or a configured PSTN/VoIP provider if available.
        // We mark callStatus as "initiated" to signal the frontend
        // to open the tel: link.
        // ========================================================

        event.callStatus = "initiated";
        await event.save();

        // ========================================================
        // RETURN FULL PATIENT AND EVENT DATA TO FRONTEND
        // ========================================================

        return res.status(201).json({
            success: true,
            message: smsSuccess
                ? "Emergency event created, SMS sent, call initiated"
                : "Emergency event created, SMS failed, call initiated",
            data: {
                event,
                patient: {
                    name: patientName,
                    age: patient.age,
                    medJarvisId: patient.medJarvisId,
                    phone: patient.phone,
                    emergencyContact: phone,
                    photo: patient.photo || "",
                },
                smsStatus: smsSuccess ? "accepted" : "failed",
                callStatus: "initiated",
                emergencyContact: phone,
            },
        });

    } catch (error) {
        console.error("CREATE EMERGENCY ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to process emergency event",
        });
    }
};

// ============================================================
// RESOLVE EMERGENCY EVENT
// Called when user presses "I'M SAFE — STOP EMERGENCY"
// ============================================================

export const resolveEmergencyEvent = async (req, res) => {
    try {
        const { eventId } = req.params;

        if (!eventId) {
            return res.status(400).json({
                success: false,
                message: "eventId is required",
            });
        }

        const event = await EmergencyEvent.findById(eventId);

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Emergency event not found",
            });
        }

        // Already resolved — idempotent
        if (event.status === "resolved") {
            return res.status(200).json({
                success: true,
                message: "Emergency already resolved",
                data: event,
            });
        }

        event.status = "resolved";
        event.resolvedAt = new Date();

        await event.save();

        return res.status(200).json({
            success: true,
            message: "Emergency event resolved",
            data: event,
        });

    } catch (error) {
        console.error("RESOLVE EMERGENCY ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to resolve emergency event",
        });
    }
};

// ============================================================
// GET EMERGENCY EVENT BY ID
// Used by frontend to refresh state after declaration
// ============================================================

export const getEmergencyEvent = async (req, res) => {
    try {
        const { eventId } = req.params;

        const event = await EmergencyEvent.findById(eventId)
            .populate("patient")
            .populate("band")
            .populate("session");

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Emergency event not found",
            });
        }

        return res.status(200).json({
            success: true,
            data: event,
        });

    } catch (error) {
        console.error("GET EMERGENCY ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to get emergency event",
        });
    }
};