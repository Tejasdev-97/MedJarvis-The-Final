import express from "express";

import protect from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/roleMiddleware.js";
import requirePatientAccess from "../middleware/requirePatientAccess.js";

import {
    patientSummary,
    testGeminiKey,
} from "../controllers/aiController.js";

const router = express.Router();

// ============================================================
// TEST GEMINI KEY
// ============================================================

router.post(
    "/test-key",
    protect,
    authorizeRoles(
        "Super Admin",
        "Hospital Manager",
        "Doctor",
        "Health Worker",
        "Patient"
    ),
    testGeminiKey
);

// ============================================================
// AI PATIENT SUMMARY
// For staff routes — requirePatientAccess enforces consent gate.
// The controller internally handles the Patient self-access case
// (reads patientId from body or from the profile link).
// ============================================================

router.post(
    "/patient-summary",
    protect,
    authorizeRoles(
        "Super Admin",
        "Hospital Manager",
        "Doctor",
        "Health Worker",
        "Patient"
    ),
    // For Patient role: the controller's own resolvePatientAccess
    // handles self-access (no grant needed).
    // For staff: require AI_SUMMARY scope.
    (req, res, next) => {
        if (req.user.role === "Patient") {
            return next(); // patient self-access — no grant needed
        }
        // For staff, run the consent gate check
        return requirePatientAccess({
            scope: "AI_SUMMARY",
            // patientId falls back to req.body.patientId automatically
        })(req, res, next);
    },
    patientSummary
);

export default router;