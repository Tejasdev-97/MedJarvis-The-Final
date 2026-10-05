import express from "express";

import protect from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/roleMiddleware.js";
import requirePatientAccess from "../middleware/requirePatientAccess.js";

import {
    extractVisitFromTranscript,
    saveVisit,
    getPatientVisits,
} from "../controllers/visitController.js";

const router = express.Router();

// ============================================================
// EXTRACT STRUCTURED DATA FROM VOICE TRANSCRIPT
// Only doctors and health workers can do this
// ============================================================

router.post(
    "/extract",
    protect,
    authorizeRoles(
        "Super Admin",
        "Hospital Manager",
        "Doctor",
        "Health Worker"
    ),
    extractVisitFromTranscript
);

// ============================================================
// SAVE CONFIRMED VISIT
// Requires VISIT_NOTES scope grant
// ============================================================

router.post(
    "/",
    protect,
    authorizeRoles(
        "Super Admin",
        "Hospital Manager",
        "Doctor",
        "Health Worker"
    ),
    saveVisit
);

// ============================================================
// GET ALL VISITS FOR A PATIENT
// Staff need active consent with VISIT_NOTES scope.
// Patient self-access always allowed.
// ============================================================

router.get(
    "/:patientId",
    protect,
    authorizeRoles(
        "Super Admin",
        "Hospital Manager",
        "Doctor",
        "Health Worker",
        "Patient"
    ),
    requirePatientAccess({ scope: "VISIT_NOTES" }),
    getPatientVisits
);

export default router;
