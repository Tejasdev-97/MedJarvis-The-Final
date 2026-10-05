import express from "express";

import {
    addPrescription,
    getPatientPrescriptions,
    getPrescription,
    getLatestPrescription,
} from "../controllers/prescriptionController.js";

import protect from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/roleMiddleware.js";
import requirePatientAccess from "../middleware/requirePatientAccess.js";

const router = express.Router();

// ============================================================
// ADD PRESCRIPTION
// Doctor only — requires active PRESCRIPTIONS scope grant
// ============================================================

router.post(
    "/",
    protect,
    authorizeRoles("Doctor"),
    addPrescription
);

// ============================================================
// GET PATIENT PRESCRIPTIONS
// Consent-gated for staff. Patient self-access allowed.
// ============================================================

router.get(
    "/patient/:patientId",
    protect,
    authorizeRoles(
        "Doctor",
        "Health Worker",
        "Hospital Manager",
        "Super Admin",
        "Patient"
    ),
    requirePatientAccess({ scope: "PRESCRIPTIONS" }),
    getPatientPrescriptions
);

// ============================================================
// GET LATEST PRESCRIPTION
// Consent-gated for staff. Emergency access includes this.
// ============================================================

router.get(
    "/latest/:patientId",
    protect,
    authorizeRoles(
        "Doctor",
        "Health Worker",
        "Hospital Manager",
        "Super Admin",
        "Ambulance Staff",
        "Patient"
    ),
    requirePatientAccess({ scope: "PRESCRIPTIONS" }),
    getLatestPrescription
);

// ============================================================
// GET SINGLE PRESCRIPTION
// ============================================================

router.get(
    "/:id",
    protect,
    authorizeRoles(
        "Doctor",
        "Health Worker",
        "Hospital Manager",
        "Super Admin",
        "Patient"
    ),
    getPrescription
);

export default router;