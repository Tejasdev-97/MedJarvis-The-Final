import MedicalTimeline from "../models/MedicalTimeline.js";
import Prescription from "../models/Prescription.js";
import DoctorVisit from "../models/DoctorVisit.js";
import EmergencyEvent from "../models/EmergencyEvent.js";
import Profile from "../models/Profile.js";

// ============================================================
// Resolve the patient that the current user is allowed to view
// ============================================================

async function resolveTimelinePatient(req) {
    // Patient users can ONLY access their own linked patient.
    if (req.user?.role === "Patient") {
        const profile = await Profile.findById(
            req.user.profileId
        ).select("patient role");

        if (!profile || !profile.patient) {
            return null;
        }

        return profile.patient;
    }

    // Staff roles may request a specific patient.
    return req.params.patientId;
}

// ============================================================
// Add Timeline Event
// ============================================================

export const addTimelineEvent = async (req, res) => {
    try {
        const event = await MedicalTimeline.create({
            ...req.body,
            createdBy: req.user.profileId,
        });

        res.status(201).json({
            success: true,
            message: "Timeline Event Added",
            data: event,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ============================================================
// Get Patient Timeline (existing MedicalTimeline collection only)
// ============================================================

export const getPatientTimeline = async (req, res) => {
    try {
        const patientId =
            await resolveTimelinePatient(req);

        if (!patientId) {
            return res.status(404).json({
                success: false,
                message:
                    "Patient profile is not linked to a patient record.",
            });
        }

        const timeline =
            await MedicalTimeline.find({
                patient: patientId,
            })
                .populate(
                    "createdBy",
                    "displayName role"
                )
                .sort({
                    createdAt: -1,
                });

        res.status(200).json({
            success: true,
            count: timeline.length,
            data: timeline,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ============================================================
// Get Full Patient History
// Aggregates: MedicalTimeline + Prescriptions + DoctorVisits + Emergency
// Returns a unified, sorted array with a `_source` field on each entry
// ============================================================

export const getFullPatientHistory = async (req, res) => {
    try {
        const patientId =
            await resolveTimelinePatient(req);

        if (!patientId) {
            return res.status(404).json({
                success: false,
                message:
                    "Patient profile is not linked to a patient record.",
            });
        }

        // ── Fetch all four sources in parallel ──

        const [timelineEvents, prescriptions, visits, emergencies] =
            await Promise.all([

                MedicalTimeline.find({ patient: patientId })
                    .populate("createdBy", "displayName role")
                    .lean(),

                Prescription.find({ patient: patientId })
                    .populate("doctor", "displayName role")
                    .lean(),

                DoctorVisit.find({ patient: patientId })
                    .populate("doctor", "displayName role")
                    .lean(),

                EmergencyEvent.find({ patient: patientId })
                    .lean()
                    .catch(() => []), // graceful: some patients may have no emergencies
            ]);

        // ── Normalise each source into a common shape ──

        const normalised = [];

        for (const e of timelineEvents) {
            normalised.push({
                _id: e._id,
                _source: "timeline",
                eventType: e.eventType || "Other",
                title: e.title,
                description: e.description,
                date: e.createdAt,
                createdBy: e.createdBy,
                raw: e,
            });
        }

        for (const p of prescriptions) {
            const medList = (p.medicines || [])
                .map((m) => m.medicineName)
                .filter(Boolean)
                .join(", ");

            normalised.push({
                _id: p._id,
                _source: "prescription",
                eventType: "Prescription",
                title: `Prescription: ${p.diagnosis || "No diagnosis"}`,
                description: medList
                    ? `Medicines: ${medList}`
                    : p.notes || "Prescription recorded.",
                date: p.createdAt,
                createdBy: p.doctor,
                raw: p,
            });
        }

        for (const v of visits) {
            normalised.push({
                _id: v._id,
                _source: "visit",
                eventType: "Checkup",
                title: v.chiefComplaint
                    ? `Visit: ${v.chiefComplaint}`
                    : "Doctor Visit",
                description: v.clinicalNotes || v.rawTranscript || "Consultation recorded.",
                date: v.visitDate || v.createdAt,
                createdBy: v.doctor,
                raw: v,
            });
        }

        for (const em of emergencies) {
            normalised.push({
                _id: em._id,
                _source: "emergency",
                eventType: "Emergency",
                title: `Emergency: ${em.type ? em.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Emergency event"}`,
                description: em.message || em.notes || `Severity: ${em.severity || "HIGH"} — ${em.status || "recorded"}.`,
                date: em.createdAt,
                createdBy: null,
                raw: em,
            });
        }

        // ── Sort newest first ──
        normalised.sort(
            (a, b) => new Date(b.date) - new Date(a.date)
        );

        return res.status(200).json({
            success: true,
            count: normalised.length,
            data: normalised,
        });
    } catch (error) {
        console.error("FULL HISTORY ERROR:", error);
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};