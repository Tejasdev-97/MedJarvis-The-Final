import express from "express";

import {
    addTimelineEvent,
    getPatientTimeline,
    getFullPatientHistory,
} from "../controllers/medicalTimelineController.js";

import protect from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/roleMiddleware.js";
import requirePatientAccess from "../middleware/requirePatientAccess.js";

const router = express.Router();

// ============================================================
// ADD TIMELINE EVENT
// Healthcare staff only — needs VISIT_NOTES scope
// ============================================================

router.post(
    "/",
    protect,
    authorizeRoles(
        "Doctor",
        "Health Worker",
        "Hospital Manager"
    ),
    addTimelineEvent
);

// ============================================================
// GET FULL PATIENT HISTORY (aggregated across all sources)
// IMPORTANT: Must be registered BEFORE /:patientId to avoid
// Express matching "full" as a patientId value.
// ============================================================

router.get(
    "/full/:patientId",
    protect,
    authorizeRoles(
        "Doctor",
        "Health Worker",
        "Hospital Manager",
        "Super Admin",
        "Ambulance Staff",
        "Patient"
    ),
    requirePatientAccess({ scope: "MEDICAL_HISTORY" }),
    getFullPatientHistory
);

// ============================================================
// GET PATIENT TIMELINE (MedicalTimeline collection only)
// ============================================================

router.get(
    "/:patientId",
    protect,
    authorizeRoles(
        "Doctor",
        "Health Worker",
        "Hospital Manager",
        "Super Admin",
        "Ambulance Staff",
        "Patient"
    ),
    requirePatientAccess({ scope: "MEDICAL_HISTORY" }),
    getPatientTimeline
);

export default router;