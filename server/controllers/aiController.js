import Patient from "../models/Patient.js";
import Prescription from "../models/Prescription.js";
import MedicalTimeline from "../models/MedicalTimeline.js";
import Profile from "../models/Profile.js";
import DoctorVisit from "../models/DoctorVisit.js";
import VitalReading from "../models/VitalReading.js";

import { generateGeminiResponse } from "../services/geminiService.js";

// ============================================================
// Resolve patient access
// ============================================================

async function resolvePatientAccess(req, patientId) {
    if (req.user?.role === "Patient") {
        const profile = await Profile.findById(req.user.profileId).select("patient role");

        if (!profile?.patient) {
            return null;
        }

        if (patientId && String(profile.patient) !== String(patientId)) {
            return null;
        }

        return profile.patient;
    }

    return patientId;
}

// ============================================================
// Local Structured Health Summary Generator (Fallback)
// ============================================================

function generateLocalHealthSummary({ patient, prescriptions, doctorVisits, timeline, latestVital }) {
    const lines = [];

    lines.push(`## 🏥 Patient Overview`);
    lines.push(`**Name:** ${patient.firstName || ""} ${patient.lastName || ""}`);
    lines.push(`**Age:** ${patient.age ?? "N/A"} | **Gender:** ${patient.gender || "N/A"} | **Blood Group:** ${patient.bloodGroup || "N/A"}`);
    lines.push(`**Status:** ${patient.status || "Healthy"}`);
    lines.push(``);

    lines.push(`## 📋 Medical History & Allergies`);
    if (Array.isArray(patient.medicalHistory) && patient.medicalHistory.length > 0) {
        lines.push(`- **Medical History:** ${patient.medicalHistory.join(", ")}`);
    } else {
        lines.push(`- **Medical History:** No recorded medical history.`);
    }

    if (Array.isArray(patient.allergies) && patient.allergies.length > 0) {
        lines.push(`- **Allergies:** ${patient.allergies.join(", ")}`);
    } else {
        lines.push(`- **Allergies:** No known allergies recorded.`);
    }

    if (Array.isArray(patient.medications) && patient.medications.length > 0) {
        lines.push(`- **Long-term Medications:** ${patient.medications.join(", ")}`);
    }
    lines.push(``);

    lines.push(`## 💊 Active Prescriptions (${prescriptions?.length || 0})`);
    if (prescriptions && prescriptions.length > 0) {
        prescriptions.forEach((rx, idx) => {
            const docName = rx.doctor?.displayName ? ` (Dr. ${rx.doctor.displayName})` : "";
            const dx = rx.diagnosis ? ` — *${rx.diagnosis}*` : "";
            lines.push(`**${idx + 1}. Prescription${docName}${dx}**`);
            if (Array.isArray(rx.medicines)) {
                rx.medicines.forEach((m) => {
                    lines.push(`  - **${m.medicineName}**: ${m.dosage || ''} | ${m.frequency || ''} | ${m.duration || ''}`);
                });
            }
        });
    } else {
        lines.push(`- No active prescriptions recorded in system.`);
    }
    lines.push(``);

    lines.push(`## 🩺 Doctor Visits & Voice Notes (${doctorVisits?.length || 0})`);
    if (doctorVisits && doctorVisits.length > 0) {
        doctorVisits.forEach((v, idx) => {
            const docName = v.doctor?.displayName ? `Dr. ${v.doctor.displayName}` : "Attending Doctor";
            const dateStr = v.visitDate ? new Date(v.visitDate).toLocaleDateString() : "Recent";
            lines.push(`**${idx + 1}. Visit on ${dateStr} with ${docName}**`);
            if (v.chiefComplaint) lines.push(`  - **Chief Complaint:** ${v.chiefComplaint}`);
            if (Array.isArray(v.symptoms) && v.symptoms.length > 0) lines.push(`  - **Symptoms:** ${v.symptoms.join(", ")}`);
            if (v.clinicalNotes) lines.push(`  - **Notes:** ${v.clinicalNotes}`);
            if (v.followUpDate) lines.push(`  - **Follow-up Date:** ${new Date(v.followUpDate).toLocaleDateString()}`);
        });
    } else {
        lines.push(`- No recorded doctor visit notes.`);
    }
    lines.push(``);

    lines.push(`## 💓 Latest Vitals & Sensor Readings`);
    if (latestVital) {
        const hr = latestVital.heartRate !== null && latestVital.heartRate !== undefined ? `${latestVital.heartRate} bpm` : "N/A";
        const spo2 = latestVital.spo2 !== null && latestVital.spo2 !== undefined ? `${latestVital.spo2}%` : "N/A";
        const temp = latestVital.temperature !== null && latestVital.temperature !== undefined ? `${latestVital.temperature} °C` : "N/A";
        const dateStr = latestVital.createdAt ? new Date(latestVital.createdAt).toLocaleString() : "";
        lines.push(`- **Heart Rate:** ${hr} | **SpO₂:** ${spo2} | **Temperature:** ${temp}`);
        if (dateStr) lines.push(`- **Measured At:** ${dateStr}`);
    } else {
        lines.push(`- No recent sensor vital readings recorded.`);
    }
    lines.push(``);

    lines.push(`> ℹ️ *This summary was retrieved locally from stored database records.*`);

    return lines.join("\n");
}

// ============================================================
// Test Gemini connection
// ============================================================

export async function testGeminiKey(req, res) {
    try {
        const apiKey = req.body.apiKey || process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;

        if (!apiKey) {
            return res.status(400).json({
                success: false,
                message: "Gemini API key is required.",
            });
        }

        const result = await generateGeminiResponse({
            apiKey,
            prompt: "Reply only with: Gemini connection successful.",
        });

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.json(result);
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

// ============================================================
// AI / Database Health Summary
// ============================================================

export async function patientSummary(req, res) {
    try {
        const { patientId, apiKey, regenerate } = req.body;

        const resolvedPatientId = await resolvePatientAccess(req, patientId);

        if (!resolvedPatientId) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to access this patient's AI summary.",
            });
        }

        const patient = await Patient.findById(resolvedPatientId);

        if (!patient) {
            return res.status(404).json({
                success: false,
                message: "Patient not found.",
            });
        }

        // Return cached summary when regeneration is not requested
        if (patient.aiSummary && !regenerate) {
            return res.json({
                success: true,
                cached: true,
                summary: patient.aiSummary,
                generatedAt: patient.aiSummaryGeneratedAt,
            });
        }

        // Gather all patient records from MongoDB Atlas
        const prescriptions = await Prescription.find({ patient: resolvedPatientId })
            .populate("doctor", "displayName")
            .sort({ createdAt: -1 });

        const doctorVisits = await DoctorVisit.find({ patient: resolvedPatientId })
            .populate("doctor", "displayName")
            .sort({ visitDate: -1 });

        const timeline = await MedicalTimeline.find({ patient: resolvedPatientId })
            .sort({ createdAt: -1 });

        const latestVital = await VitalReading.findOne({ patient: resolvedPatientId })
            .sort({ createdAt: -1 });

        // Resolve API key (req.body -> server env)
        const effectiveApiKey = apiKey || process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;

        let summaryText = "";
        let modelUsed = process.env.GEMINI_MODEL || "gemini-2.0-flash";

        // Try Gemini AI if an API key is available
        if (effectiveApiKey) {
            const prompt = `
You are MedJarvis AI.

Generate a concise, doctor-friendly patient health summary.

PATIENT

Name:
${patient.firstName || ""} ${patient.lastName || ""}

Age:
${patient.age ?? "Not available"}

Gender:
${patient.gender || "Not available"}

Blood Group:
${patient.bloodGroup || "Not available"}

Status:
${patient.status || "Not available"}

MEDICAL HISTORY
${Array.isArray(patient.medicalHistory) ? patient.medicalHistory.join(", ") : "No medical history recorded"}

ALLERGIES
${Array.isArray(patient.allergies) ? patient.allergies.join(", ") : "No allergies recorded"}

CURRENT MEDICATIONS
${Array.isArray(patient.medications) ? patient.medications.join(", ") : "No medications recorded"}

PRESCRIPTIONS
${JSON.stringify(prescriptions, null, 2)}

DOCTOR VISITS & VOICE NOTES
${JSON.stringify(doctorVisits, null, 2)}

MEDICAL TIMELINE
${JSON.stringify(timeline, null, 2)}

LATEST VITALS
${JSON.stringify(latestVital, null, 2)}

Generate the following sections in clean Markdown format:

1. Overall Health
2. Risks
3. Current Treatment
4. Recent Doctor Visits & Observations
5. Recommendations

Do not invent information.
Clearly indicate when information is unavailable.
Maximum 300 words.
`;

            try {
                const result = await generateGeminiResponse({
                    apiKey: effectiveApiKey,
                    prompt,
                });

                if (result.success && result.text) {
                    summaryText = result.text;
                } else {
                    console.warn("Gemini API call returned error, falling back to local aggregator:", result.message);
                }
            } catch (geminiError) {
                console.warn("Gemini API call failed, falling back to local aggregator:", geminiError.message);
            }
        }

        // Fallback: If Gemini key is missing or failed (rate limit, offline, quota exceeded), generate local summary
        if (!summaryText) {
            summaryText = generateLocalHealthSummary({
                patient,
                prescriptions,
                doctorVisits,
                timeline,
                latestVital,
            });
            modelUsed = "Local Database Aggregator (Fallback)";
        }

        // Save generated summary
        patient.aiSummary = summaryText;
        patient.aiSummaryGeneratedAt = new Date();
        patient.aiSummaryModel = modelUsed;

        await patient.save();

        return res.json({
            success: true,
            cached: false,
            summary: summaryText,
            generatedAt: patient.aiSummaryGeneratedAt,
            model: modelUsed,
        });
    } catch (err) {
        console.error("AI PATIENT SUMMARY ERROR:", err);

        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}