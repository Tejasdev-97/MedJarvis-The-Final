console.log("🔥 VITALS ROUTES FILE LOADED");

import express from "express";

import {
    createVitalReading,
    updateSensorStatus,
    getLatestVital,
    getPatientVitals,
    startMonitoring,
    stopMonitoring,
    getMonitoringControl,
    completeMonitoring,
} from "../controllers/vitalsController.js";

import protect from "../middleware/authMiddleware.js";
import requirePatientAccess from "../middleware/requirePatientAccess.js";

const router = express.Router();

// ============================================================
// ESP32 -> Backend
// ============================================================

// ------------------------------------------------------------
// SENSOR STATUS
//
// ESP32 sends actual sensor-state messages here.
//
// Example:
// {
//     "bandId": "BAND-MJ-001",
//     "status": "WAITING_FOR_FINGER",
//     "message": "Place your finger on the sensor.",
//     "remainingSeconds": null,
//     "mode": "spot"
// }
//
// Backend resolves:
// Band -> Active Monitoring Session -> Patient
//
// Backend then forwards the status through Socket.IO.
// ------------------------------------------------------------

router.post(
    "/status",
    updateSensorStatus
);

// ------------------------------------------------------------
// VITAL READING
//
// ESP32 sends completed Spot readings and Continuous
// monitoring windows here.
// ------------------------------------------------------------

router.post(
    "/",
    createVitalReading
);

// ============================================================
// Frontend -> Backend
// ============================================================

router.get(
    "/latest/:patientId",
    protect,
    requirePatientAccess({ scope: "VITALS" }),
    getLatestVital
);

router.get(
    "/patient/:patientId",
    protect,
    requirePatientAccess({ scope: "VITALS" }),
    getPatientVitals
);

// ============================================================
// START / STOP
// ============================================================

router.post(
    "/control/start",
    protect,
    startMonitoring
);

router.post(
    "/control/stop",
    protect,
    stopMonitoring
);

// ============================================================
// ESP32 CONTROL
// ============================================================

// ESP32 checks whether the frontend has requested monitoring.
router.get(
    "/control/:bandId",
    getMonitoringControl
);

// ESP32 tells backend that a Spot measurement has completed.
router.post(
    "/control/complete/:bandId",
    completeMonitoring
);

// ============================================================
// TEST
// ============================================================

router.get(
    "/test",
    (req, res) => {
        res.json({
            success: true,
            message: "Vitals route is working",
        });
    }
);

export default router;