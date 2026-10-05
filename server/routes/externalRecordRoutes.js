import express from "express";
import protect from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/roleMiddleware.js";
import requirePatientAccess from "../middleware/requirePatientAccess.js";

import {
    addExternalRecord,
    getExternalRecords,
    getExternalRecord,
    verifyExternalRecord,
    deleteExternalRecord,
} from "../controllers/externalRecordController.js";

const router = express.Router();

// ============================================================
// PATIENT: Add their own external record
// ============================================================
router.post(
    "/",
    protect,
    authorizeRoles("Patient", "Doctor", "Health Worker", "Hospital Manager", "Super Admin"),
    addExternalRecord
);

// ============================================================
// PATIENT: Get their own records
// STAFF: Get records for a specific patient (consent-gated)
// ============================================================

// Patient self-route
router.get(
    "/my",
    protect,
    authorizeRoles("Patient"),
    getExternalRecords
);

// Staff route — patientId in params, consent required
router.get(
    "/patient/:patientId",
    protect,
    authorizeRoles(
        "Doctor",
        "Health Worker",
        "Hospital Manager",
        "Super Admin"
    ),
    requirePatientAccess({ scope: "EXTERNAL_RECORDS" }),
    getExternalRecords
);

// ============================================================
// GET SINGLE RECORD
// ============================================================
router.get(
    "/:id",
    protect,
    authorizeRoles(
        "Patient",
        "Doctor",
        "Health Worker",
        "Hospital Manager",
        "Super Admin"
    ),
    getExternalRecord
);

// ============================================================
// VERIFY A RECORD  (clinical staff only)
// ============================================================
router.patch(
    "/:id/verify",
    protect,
    authorizeRoles("Doctor", "Hospital Manager", "Super Admin"),
    verifyExternalRecord
);

// ============================================================
// DELETE  (soft delete)
// ============================================================
router.delete(
    "/:id",
    protect,
    authorizeRoles("Patient", "Super Admin"),
    deleteExternalRecord
);

export default router;
