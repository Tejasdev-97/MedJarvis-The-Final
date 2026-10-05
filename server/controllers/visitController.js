import DoctorVisit from "../models/DoctorVisit.js";
import MedicalTimeline from "../models/MedicalTimeline.js";
import Profile from "../models/Profile.js";
import { generateGeminiResponse } from "../services/geminiService.js";

// ============================================================
// Extract structured data from transcript using Gemini
// ============================================================

export async function extractVisitFromTranscript(req, res) {
    try {
        const { transcript, apiKey } = req.body;

        if (!transcript?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Transcript is required.",
            });
        }

        const prompt = `
You are MedJarvis AI — a clinical note assistant.

A doctor has recorded the following consultation transcript:

---
${transcript}
---

Extract structured information from the transcript and return ONLY valid JSON matching this schema:

{
  "chiefComplaint": "string — main reason for visit",
  "symptoms": ["array", "of", "symptom", "strings"],
  "clinicalNotes": "string — summary of clinical observations, findings, and plan",
  "followUpDate": "ISO date string or null"
}

Rules:
- Do NOT invent information not present in the transcript.
- If a field is not mentioned, return "" or [] or null.
- Return ONLY the JSON object, no markdown, no explanation.
`;

        const result = await generateGeminiResponse({ apiKey, prompt });

        if (!result.success) {
            return res.status(400).json(result);
        }

        // Clean the response — strip markdown code fences if present
        let raw = result.text?.trim() || "";
        raw = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "");

        let extracted;
        try {
            extracted = JSON.parse(raw);
        } catch {
            return res.status(422).json({
                success: false,
                message: "Gemini returned unparseable JSON. Please try again.",
                raw: result.text,
            });
        }

        return res.json({
            success: true,
            data: extracted,
        });
    } catch (err) {
        console.error("VISIT EXTRACT ERROR:", err);
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

// ============================================================
// Save confirmed visit record
// ============================================================

export async function saveVisit(req, res) {
    try {
        const {
            patientId,
            rawTranscript,
            chiefComplaint,
            symptoms,
            clinicalNotes,
            followUpDate,
            source,
        } = req.body;

        if (!patientId) {
            return res.status(400).json({
                success: false,
                message: "Patient ID is required.",
            });
        }

        const visit = await DoctorVisit.create({
            patient: patientId,
            doctor: req.user.profileId,
            rawTranscript: rawTranscript || "",
            chiefComplaint: chiefComplaint || "",
            symptoms: Array.isArray(symptoms) ? symptoms : [],
            clinicalNotes: clinicalNotes || "",
            followUpDate: followUpDate || null,
            source: source || "MANUAL",
            confirmedAt: new Date(),
        });

        // Auto-create a timeline entry
        await MedicalTimeline.create({
            patient: patientId,
            title: chiefComplaint
                ? `Visit: ${chiefComplaint}`
                : "Doctor Visit Recorded",
            description: clinicalNotes || rawTranscript || "Consultation recorded.",
            eventType: "Checkup",
            createdBy: req.user.profileId,
        });

        return res.status(201).json({
            success: true,
            message: "Visit saved successfully.",
            data: visit,
        });
    } catch (err) {
        console.error("SAVE VISIT ERROR:", err);
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

// ============================================================
// Get all visits for a patient
// ============================================================

async function resolveVisitPatient(req) {
    if (req.user?.role === "Patient") {
        const profile = await Profile.findById(
            req.user.profileId
        ).select("patient role");

        if (!profile?.patient) return null;
        return profile.patient;
    }
    return req.params.patientId;
}

export async function getPatientVisits(req, res) {
    try {
        const patientId = await resolveVisitPatient(req);

        if (!patientId) {
            return res.status(404).json({
                success: false,
                message: "Patient profile not linked to a patient record.",
            });
        }

        const visits = await DoctorVisit.find({ patient: patientId })
            .populate("doctor", "displayName role")
            .sort({ visitDate: -1 });

        return res.status(200).json({
            success: true,
            count: visits.length,
            data: visits,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}
