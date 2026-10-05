import { useEffect, useRef, useState } from "react";
import {
    Activity,
    Gauge,
    HeartPulse,
    Play,
    Radio,
    RotateCcw,
    ShieldCheck,
    Square,
    Thermometer,
    Timer,
    Waves,
} from "lucide-react";
import api from "../services/api";
import { io } from "socket.io-client";
import {
    connectMedJarvisBand,
    disconnectMedJarvisBand,
    isWebBluetoothSupported,
    scanForMedJarvisBand,
    sendBandCommand,
} from "../services/bleBand";

const BAND_ID = "BAND-MJ-001";

export default function MyHealthPage({ overridePatientId }) {
    const profile = JSON.parse(
        localStorage.getItem("profile") || "null"
    );

    const patientId =
        overridePatientId ||
        (typeof profile?.patient === "object"
            ? profile.patient?._id
            : profile?.patient);

    const [displayVital, setDisplayVital] =
        useState(null);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    const [isLive, setIsLive] =
        useState(false);

    const [lastUpdated, setLastUpdated] =
        useState(null);

    const [selectedMode, setSelectedMode] =
        useState("spot");

    const [monitoringActive, setMonitoringActive] =
        useState(false);

    const [starting, setStarting] =
        useState(false);

    const [stopping, setStopping] =
        useState(false);

    const [sensorStatus, setSensorStatus] =
        useState("IDLE");

    const [sensorMessage, setSensorMessage] =
        useState(
            "Ready to start health monitoring."
        );

    const [remainingSeconds, setRemainingSeconds] =
        useState(null);

    const [sensorMode, setSensorMode] =
        useState(null);

    const countdownEndRef =
        useRef(null);

    const [countdownSequence, setCountdownSequence] =
        useState(0);

    const [ppgWaveform, setPpgWaveform] =
        useState([]);

    const [ppgBeatPositions, setPpgBeatPositions] =
        useState([]);

    const [waveformSequence, setWaveformSequence] =
        useState(0);

    // ============================================================
    // BLE / MEDJARVIS BAND STATE
    // ============================================================

    const [bleModalOpen, setBleModalOpen] =
        useState(false);

    const [bleScanning, setBleScanning] =
        useState(false);

    const [bleConnecting, setBleConnecting] =
        useState(false);

    const [bleConnected, setBleConnected] =
        useState(false);

    const [bleAuthorized, setBleAuthorized] =
        useState(false);

    const [bleBandId, setBleBandId] =
        useState("");

    const [bleCandidate, setBleCandidate] =
        useState(null);

    const [bleError, setBleError] =
        useState("");

    // ============================================================
    // INITIAL LOAD + SOCKET.IO
    // ============================================================

    useEffect(() => {
        if (!patientId) {
            setError(
                "Patient profile is not linked to a patient record."
            );

            setLoading(false);
            return;
        }

        let mounted = true;

        const loadInitialVital =
            async () => {
                try {
                    const response =
                        await api.get(
                            `/vitals/latest/${patientId}`
                        );

                    if (
                        mounted &&
                        response.data
                            ?.success
                    ) {
                        setDisplayVital(
                            response.data
                                .data ||
                            null
                        );

                        setError("");
                    }
                } catch (err) {
                    if (
                        mounted &&
                        err.response
                            ?.status !== 404
                    ) {
                        setError(
                            err.response
                                ?.data
                                ?.message ||
                            "Unable to load your latest health reading."
                        );
                    }
                } finally {
                    if (mounted) {
                        setLoading(
                            false
                        );
                    }
                }
            };

        loadInitialVital();

        const socket =
            io(
                import.meta.env
                    .VITE_API_URL?.replace(
                        "/api",
                        ""
                    ) ||
                "http://localhost:5000"
            );

        socket.on(
            "connect",
            () => {
                if (!mounted) {
                    return;
                }

                setIsLive(true);

                socket.emit(
                    "joinPatient",
                    patientId
                );
            }
        );

        socket.on(
            "disconnect",
            () => {
                if (mounted) {
                    setIsLive(false);
                }
            }
        );

        socket.on(
            "connect_error",
            (err) => {
                console.error(
                    "LIVE VITAL SOCKET ERROR:",
                    err.message
                );

                if (mounted) {
                    setIsLive(false);
                }
            }
        );

        // ========================================================
        // BACKEND SENSOR STATUS
        //
        // This listener remains intentionally because the backend
        // still broadcasts sensor status through Socket.IO after
        // the BLE frontend bridge forwards data/control.
        // ========================================================

        socket.on(
            "sensorStatus",
            (statusData) => {
                if (!mounted) {
                    return;
                }

                if (
                    statusData?.patientId &&
                    String(
                        statusData.patientId
                    ) !==
                    String(
                        patientId
                    )
                ) {
                    return;
                }

                const status =
                    statusData?.status ||
                    "UNKNOWN";

                setSensorStatus(
                    status
                );

                setSensorMessage(
                    statusData?.message ||
                    (status ===
                        "FINGER_REMOVED"
                        ? "Please place your finger back on the sensor and hold still."
                        : "Sensor status updated.")
                );

                setSensorMode(
                    statusData?.mode ||
                    null
                );

                setIsLive(true);

                if (
                    status ===
                    "STARTING"
                ) {
                    setDisplayVital(
                        (previous) => ({
                            ...(previous ||
                                {}),
                            spo2: null,
                            heartRate:
                                null,
                            hrvSDNN:
                                null,
                            temperature:
                                null,
                            signalQuality:
                                null,
                            measurementConfidence:
                                null,
                            spo2Confidence:
                                null,
                            heartRateConfidence:
                                null,
                            hrvConfidence:
                                null,
                            tilt: null,
                            accelMagnitude:
                                null,
                            gyroMagnitude:
                                null,
                        })
                    );

                    setPpgWaveform(
                        []
                    );

                    setPpgBeatPositions(
                        []
                    );

                    setWaveformSequence(
                        (value) =>
                            value + 1
                    );
                }

                if (
                    status ===
                    "MEASURING" &&
                    statusData?.remainingSeconds !==
                    null &&
                    statusData?.remainingSeconds !==
                    undefined
                ) {
                    const duration =
                        Math.max(
                            0,
                            Number(
                                statusData.remainingSeconds
                            ) || 0
                        );

                    countdownEndRef.current =
                        Date.now() +
                        duration *
                        1000;

                    setRemainingSeconds(
                        duration
                    );

                    setCountdownSequence(
                        (value) =>
                            value + 1
                    );
                } else {
                    countdownEndRef.current =
                        null;

                    setRemainingSeconds(
                        null
                    );
                }

                if (
                    status ===
                    "SESSION_COMPLETE" ||
                    status ===
                    "SESSION_STOPPED"
                ) {
                    setMonitoringActive(
                        false
                    );
                }
            }
        );

        // ========================================================
        // BACKEND VITAL SOCKET
        // ========================================================

        socket.on(
            "newVital",
            (vital) => {
                if (!mounted) {
                    return;
                }

                const vitalPatient =
                    typeof vital?.patient ===
                        "object"
                        ? vital.patient
                            ?._id
                        : vital?.patient;

                if (
                    vital?.patient &&
                    String(
                        vitalPatient
                    ) !==
                    String(
                        patientId
                    )
                ) {
                    return;
                }

                if (
                    Array.isArray(
                        vital?.ppgWaveform
                    ) &&
                    vital.ppgWaveform
                        .length > 1
                ) {
                    const incomingSamples =
                        vital.ppgWaveform
                            .map(Number)
                            .filter(
                                Number.isFinite
                            );

                    const incomingBeats =
                        Array.isArray(
                            vital?.ppgBeatPositions
                        )
                            ? vital.ppgBeatPositions
                                .map(
                                    Number
                                )
                                .filter(
                                    Number.isInteger
                                )
                            : [];

                    const isContinuousPacket =
                        vital?.mode ===
                        "continuous";

                    if (
                        isContinuousPacket
                    ) {
                        const appendCount =
                            Math.min(
                                100,
                                incomingSamples.length
                            );

                        const appendStart =
                            incomingSamples.length -
                            appendCount;

                        setPpgWaveform(
                            (previous) => {
                                const combinedLength =
                                    previous.length +
                                    appendCount;

                                const trimCount =
                                    Math.max(
                                        0,
                                        combinedLength -
                                        256
                                    );

                                return [
                                    ...previous,
                                    ...incomingSamples.slice(
                                        appendStart
                                    ),
                                ].slice(
                                    trimCount
                                );
                            }
                        );

                        setPpgBeatPositions(
                            (previous) => {
                                const appendCountSafe =
                                    appendCount;

                                const combinedLength =
                                    previous.length +
                                    appendCountSafe;

                                const trimCount =
                                    Math.max(
                                        0,
                                        combinedLength -
                                        256
                                    );

                                const shiftedOldBeats =
                                    previous
                                        .map(
                                            (
                                                position
                                            ) =>
                                                Number(
                                                    position
                                                ) -
                                                trimCount
                                        )
                                        .filter(
                                            (
                                                position
                                            ) =>
                                                Number.isInteger(
                                                    position
                                                ) &&
                                                position >=
                                                0
                                        );

                                const newBeats =
                                    incomingBeats
                                        .filter(
                                            (
                                                position
                                            ) =>
                                                position >=
                                                appendStart &&
                                                position <
                                                incomingSamples.length
                                        )
                                        .map(
                                            (
                                                position
                                            ) =>
                                                previous.length +
                                                (position -
                                                    appendStart) -
                                                trimCount
                                        );

                                return [
                                    ...shiftedOldBeats,
                                    ...newBeats,
                                ]
                                    .filter(
                                        (
                                            position
                                        ) =>
                                            position >=
                                            0 &&
                                            position <
                                            Math.min(
                                                256,
                                                combinedLength
                                            )
                                    )
                                    .slice(
                                        -16
                                    );
                            }
                        );
                    } else {
                        setPpgWaveform(
                            incomingSamples.slice(
                                -256
                            )
                        );

                        setPpgBeatPositions(
                            incomingBeats
                                .filter(
                                    (
                                        position
                                    ) =>
                                        position >=
                                        0 &&
                                        position <
                                        incomingSamples.length
                                )
                                .slice(
                                    -16
                                )
                        );
                    }

                    setWaveformSequence(
                        (value) =>
                            value + 1
                    );
                }

                setDisplayVital(
                    (previous) => {
                        if (!previous) {
                            return {
                                ...vital,
                            };
                        }

                        return {
                            ...previous,
                            ...vital,

                            spo2:
                                vital.spo2 !=
                                    null
                                    ? vital.spo2
                                    : previous.spo2,

                            heartRate:
                                vital.heartRate !=
                                    null
                                    ? vital.heartRate
                                    : previous.heartRate,

                            hrvSDNN:
                                vital.hrvSDNN !=
                                    null
                                    ? vital.hrvSDNN
                                    : previous.hrvSDNN,

                            measurementConfidence:
                                vital.measurementConfidence !=
                                    null
                                    ? vital.measurementConfidence
                                    : previous.measurementConfidence,

                            spo2Confidence:
                                vital.spo2Confidence !=
                                    null
                                    ? vital.spo2Confidence
                                    : previous.spo2Confidence,

                            heartRateConfidence:
                                vital.heartRateConfidence !=
                                    null
                                    ? vital.heartRateConfidence
                                    : previous.heartRateConfidence,

                            hrvConfidence:
                                vital.hrvConfidence !=
                                    null
                                    ? vital.hrvConfidence
                                    : previous.hrvConfidence,

                            temperature:
                                vital.temperature !=
                                    null
                                    ? vital.temperature
                                    : previous.temperature,

                            signalQuality:
                                vital.signalQuality !=
                                    null
                                    ? vital.signalQuality
                                    : previous.signalQuality,

                            tilt:
                                vital.tilt !=
                                    null
                                    ? vital.tilt
                                    : previous.tilt,

                            accelMagnitude:
                                vital.accelMagnitude !=
                                    null
                                    ? vital.accelMagnitude
                                    : previous.accelMagnitude,

                            gyroMagnitude:
                                vital.gyroMagnitude !=
                                    null
                                    ? vital.gyroMagnitude
                                    : previous.gyroMagnitude,
                        };
                    }
                );

                if (
                    vital?.signalQuality !=
                    null
                ) {
                    setSensorMessage(
                        getSignalQualityMessage(
                            vital.signalQuality
                        )
                    );
                }

                setLastUpdated(
                    new Date()
                );

                setError("");
                setIsLive(true);

                if (
                    vital?.mode ===
                    "spot"
                ) {
                    setSensorMessage(
                        "Reading received. Finalizing the Spot measurement..."
                    );
                }
            }
        );

        // ========================================================
        // BACKEND MONITORING STATE
        // ========================================================

        socket.on(
            "monitoringState",
            (stateData) => {
                if (!mounted) {
                    return;
                }

                if (
                    stateData?.patientId &&
                    String(
                        stateData.patientId
                    ) !==
                    String(
                        patientId
                    )
                ) {
                    return;
                }

                if (
                    stateData?.active ===
                    false
                ) {
                    setMonitoringActive(
                        false
                    );

                    setRemainingSeconds(
                        null
                    );

                    if (
                        stateData.state ===
                        "COMPLETED"
                    ) {
                        setSensorStatus(
                            "SESSION_COMPLETE"
                        );

                        setSensorMessage(
                            "Spot monitoring completed. You can start a new monitoring session."
                        );
                    } else if (
                        stateData.state ===
                        "STOPPED"
                    ) {
                        setSensorStatus(
                            "SESSION_STOPPED"
                        );

                        setSensorMessage(
                            "Monitoring stopped. You can start a new session."
                        );
                    }
                }
            }
        );

        return () => {
            mounted = false;
            socket.disconnect();
        };
    }, [patientId]);

    // ============================================================
    // COUNTDOWN
    // ============================================================

    useEffect(() => {
        if (
            sensorStatus !==
            "MEASURING" ||
            countdownEndRef.current ===
            null
        ) {
            return;
        }

        const updateCountdown =
            () => {
                const remaining =
                    Math.max(
                        0,
                        Math.ceil(
                            (countdownEndRef.current -
                                Date.now()) /
                            1000
                        )
                    );

                setRemainingSeconds(
                    remaining
                );

                if (
                    remaining <= 0
                ) {
                    countdownEndRef.current =
                        null;
                }
            };

        updateCountdown();

        const interval =
            setInterval(
                updateCountdown,
                100
            );

        return () =>
            clearInterval(
                interval
            );
    }, [
        countdownSequence,
        sensorStatus,
    ]);

    // ============================================================
    // START MONITORING
    //
    // IMPORTANT:
    // Backend session is created first.
    // Then BLE START command is sent to ESP32.
    //
    // This preserves the existing MonitoringSession model.
    // ============================================================

    const startMonitoring =
        async () => {
            if (
                starting ||
                monitoringActive
            ) {
                return;
            }

            if (
                !bleConnected ||
                !bleAuthorized
            ) {
                setBleModalOpen(
                    true
                );

                setError(
                    "Connect and authorize the MedJarvis Band before starting monitoring."
                );

                return;
            }

            setStarting(true);
            setError("");

            setDisplayVital(
                null
            );

            setPpgWaveform(
                []
            );

            setPpgBeatPositions(
                []
            );

            setWaveformSequence(
                (value) =>
                    value + 1
            );

            setRemainingSeconds(
                null
            );

            setSensorStatus(
                "STARTING"
            );

            setSensorMessage(
                "Starting monitoring and waiting for the sensor..."
            );

            try {
                const response =
                    await api.post(
                        "/vitals/control/start",
                        {
                            bandId:
                                BAND_ID,
                            mode:
                                selectedMode,
                        }
                    );

                if (
                    !response.data
                        ?.success
                ) {
                    throw new Error(
                        response.data
                            ?.message ||
                        "Unable to create the monitoring session."
                    );
                }

                setMonitoringActive(
                    true
                );

                setSensorMode(
                    selectedMode
                );

                setSensorStatus(
                    "STARTING"
                );

                setSensorMessage(
                    "Monitoring session started. Starting the ESP32 sensor..."
                );

                const command =
                    selectedMode ===
                        "continuous"
                        ? "START_CONTINUOUS"
                        : "START_SPOT";

                try {
                    await sendBandCommand(
                        command
                    );
                } catch (
                bleCommandError
                ) {
                    /*
                     * Prevent an orphaned backend session if the
                     * ESP32 could not receive the BLE command.
                     */

                    try {
                        await api.post(
                            "/vitals/control/stop",
                            {
                                bandId:
                                    BAND_ID,
                            }
                        );
                    } catch (
                    rollbackError
                    ) {
                        console.error(
                            "MONITORING ROLLBACK ERROR:",
                            rollbackError
                        );
                    }

                    throw bleCommandError;
                }
            } catch (err) {
                setError(
                    err.response?.data
                        ?.message ||
                    err.message ||
                    "Unable to start monitoring."
                );

                setMonitoringActive(
                    false
                );

                setSensorStatus(
                    "IDLE"
                );

                setSensorMessage(
                    "Ready to start health monitoring."
                );
            } finally {
                setStarting(false);
            }
        };

    // ============================================================
    // STOP MONITORING
    // ============================================================

    const stopMonitoring =
        async () => {
            if (stopping) {
                return;
            }

            setStopping(true);

            setSensorStatus(
                "STOPPING"
            );

            setSensorMessage(
                "Stopping monitoring..."
            );

            try {
                /*
                 * ESP32 must receive STOP over BLE.
                 *
                 * The backend STOP call remains because it closes
                 * the MonitoringSession and releases the Band.
                 */

                if (
                    bleConnected &&
                    bleAuthorized
                ) {
                    try {
                        await sendBandCommand(
                            "STOP"
                        );
                    } catch (
                    bleCommandError
                    ) {
                        console.warn(
                            "BLE STOP command warning:",
                            bleCommandError
                        );
                    }
                }

                const response =
                    await api.post(
                        "/vitals/control/stop",
                        {
                            bandId:
                                BAND_ID,
                        }
                    );

                if (
                    response.data
                        ?.success
                ) {
                    setMonitoringActive(
                        false
                    );

                    setRemainingSeconds(
                        null
                    );

                    setSensorStatus(
                        "SESSION_STOPPED"
                    );

                    setSensorMessage(
                        "Monitoring stopped. You can start a new session."
                    );
                }
            } catch (err) {
                setError(
                    err.response?.data
                        ?.message ||
                    err.message ||
                    "Unable to stop monitoring."
                );
            } finally {
                setStopping(false);
            }
        };

    // ============================================================
    // BLE STATUS HANDLER
    // ============================================================

    const handleBleStatus =
        async (
            statusData
        ) => {
            if (!statusData) {
                return;
            }

            /*
             * Authorization response.
             */

            if (
                statusData.type ===
                "auth"
            ) {
                setBleAuthorized(
                    statusData.authorized ===
                    true
                );

                if (
                    statusData.authorized ===
                    true
                ) {
                    setBleError(
                        ""
                    );

                    setSensorMessage(
                        "MedJarvis Band authorized and ready."
                    );
                }

                return;
            }

            const status =
                statusData.status ||
                "";

            if (!status) {
                return;
            }

            setSensorStatus(
                status
            );

            setSensorMessage(
                statusData.message ||
                "Sensor status updated."
            );

            setSensorMode(
                statusData.mode ||
                null
            );

            if (
                status ===
                "MEASURING" &&
                statusData.remainingSeconds !==
                null &&
                statusData.remainingSeconds !==
                undefined
            ) {
                const duration =
                    Math.max(
                        0,
                        Number(
                            statusData.remainingSeconds
                        ) || 0
                    );

                countdownEndRef.current =
                    Date.now() +
                    duration *
                    1000;

                setRemainingSeconds(
                    duration
                );

                setCountdownSequence(
                    (value) =>
                        value + 1
                );
            } else {
                countdownEndRef.current =
                    null;

                setRemainingSeconds(
                    null
                );
            }

            if (
                status ===
                "SESSION_COMPLETE"
            ) {
                setMonitoringActive(
                    false
                );

                setRemainingSeconds(
                    null
                );

                /*
                 * ESP32 has completed its acquisition.
                 * Close the backend MonitoringSession.
                 */

                try {
                    await api.post(
                        `/vitals/control/complete/${BAND_ID}`
                    );
                } catch (
                completeError
                ) {
                    console.error(
                        "MONITORING COMPLETE SYNC ERROR:",
                        completeError
                    );
                }
            }

            if (
                status ===
                "SESSION_STOPPED"
            ) {
                setMonitoringActive(
                    false
                );

                setRemainingSeconds(
                    null
                );
            }

            if (
                status ===
                "SENSOR_ERROR" ||
                status ===
                "COMMUNICATION_ERROR"
            ) {
                setError(
                    statusData.message ||
                    "The MedJarvis Band reported a sensor communication problem."
                );
            }
        };

    // ============================================================
    // BLE VITALS HANDLER
    // ============================================================

    const handleBleVitals =
        async (
            vital
        ) => {
            if (!vital) {
                return;
            }

            /*
             * ESP32 does not need to know the patient's MongoDB ID.
             * The active backend MonitoringSession already maps the
             * Band to the patient.
             *
             * Adding patient here keeps the existing frontend
             * display/socket contract intact.
             */

            const enrichedVital =
            {
                ...vital,
                patient:
                    patientId,
                bandId:
                    vital.bandId ||
                    BAND_ID,
            };

            /*
             * Spot final and Continuous physiological snapshots
             * can contain a 256-sample PPG snapshot.
             *
             * Live PPG is separately streamed over BLE and handled
             * below by handleBlePPG().
             */

            if (
                Array.isArray(
                    vital.ppgWaveform
                ) &&
                vital.ppgWaveform
                    .length > 1
            ) {
                const incomingSamples =
                    vital.ppgWaveform
                        .map(Number)
                        .filter(
                            Number.isFinite
                        );

                const incomingBeats =
                    Array.isArray(
                        vital.ppgBeatPositions
                    )
                        ? vital.ppgBeatPositions
                            .map(
                                Number
                            )
                            .filter(
                                Number.isInteger
                            )
                        : [];

                setPpgWaveform(
                    incomingSamples.slice(
                        -256
                    )
                );

                setPpgBeatPositions(
                    incomingBeats
                        .filter(
                            (
                                position
                            ) =>
                                position >=
                                0 &&
                                position <
                                incomingSamples.length
                        )
                        .slice(-16)
                );

                setWaveformSequence(
                    (value) =>
                        value + 1
                );
            }

            setDisplayVital(
                (previous) => {
                    if (!previous) {
                        return {
                            ...enrichedVital,
                        };
                    }

                    return {
                        ...previous,
                        ...enrichedVital,

                        spo2:
                            vital.spo2 !=
                                null
                                ? vital.spo2
                                : previous.spo2,

                        heartRate:
                            vital.heartRate !=
                                null
                                ? vital.heartRate
                                : previous.heartRate,

                        hrvSDNN:
                            vital.hrvSDNN !=
                                null
                                ? vital.hrvSDNN
                                : previous.hrvSDNN,

                        measurementConfidence:
                            vital.measurementConfidence !=
                                null
                                ? vital.measurementConfidence
                                : previous.measurementConfidence,

                        spo2Confidence:
                            vital.spo2Confidence !=
                                null
                                ? vital.spo2Confidence
                                : previous.spo2Confidence,

                        heartRateConfidence:
                            vital.heartRateConfidence !=
                                null
                                ? vital.heartRateConfidence
                                : previous.heartRateConfidence,

                        hrvConfidence:
                            vital.hrvConfidence !=
                                null
                                ? vital.hrvConfidence
                                : previous.hrvConfidence,

                        temperature:
                            vital.temperature !=
                                null
                                ? vital.temperature
                                : previous.temperature,

                        signalQuality:
                            vital.signalQuality !=
                                null
                                ? vital.signalQuality
                                : previous.signalQuality,

                        tilt:
                            vital.tilt !=
                                null
                                ? vital.tilt
                                : previous.tilt,

                        accelMagnitude:
                            vital.accelMagnitude !=
                                null
                                ? vital.accelMagnitude
                                : previous.accelMagnitude,

                        gyroMagnitude:
                            vital.gyroMagnitude !=
                                null
                                ? vital.gyroMagnitude
                                : previous.gyroMagnitude,
                    };
                }
            );

            if (
                vital.signalQuality !=
                null
            ) {
                setSensorMessage(
                    getSignalQualityMessage(
                        vital.signalQuality
                    )
                );
            }

            setLastUpdated(
                new Date()
            );

            setError("");
            setIsLive(true);

            if (
                vital.mode ===
                "spot"
            ) {
                setSensorMessage(
                    "Reading received. Finalizing the Spot measurement..."
                );
            }

            /*
             * Existing backend remains responsible for persistence.
             *
             * ESP32:
             * BLE -> frontend
             *
             * Frontend:
             * POST /vitals -> existing controller -> MongoDB
             */

            try {
                await api.post(
                    "/vitals",
                    enrichedVital
                );
            } catch (
            persistError
            ) {
                console.error(
                    "BLE VITAL PERSISTENCE ERROR:",
                    persistError
                );
            }
        };

    // ============================================================
    // BLE LIVE PPG HANDLER
    // ============================================================

    const handleBlePPG =
        (
            packet
        ) => {
            if (
                !packet?.samples
                    ?.length
            ) {
                return;
            }

            const incomingSamples =
                packet.samples
                    .map(Number)
                    .filter(
                        Number.isFinite
                    );

            if (
                !incomingSamples.length
            ) {
                return;
            }

            const appendCount =
                incomingSamples.length;

            setPpgWaveform(
                (previous) => {
                    const combinedLength =
                        previous.length +
                        appendCount;

                    const trimCount =
                        Math.max(
                            0,
                            combinedLength -
                            256
                        );

                    return [
                        ...previous,
                        ...incomingSamples,
                    ].slice(
                        trimCount
                    );
                }
            );

            setPpgBeatPositions(
                (previous) => {
                    const newBeats =
                        packet.beatPositions ||
                        [];

                    const shiftedOldBeats =
                        previous
                            .map(
                                (
                                    position
                                ) =>
                                    Number(
                                        position
                                    ) -
                                    appendCount
                            )
                            .filter(
                                (
                                    position
                                ) =>
                                    Number.isInteger(
                                        position
                                    ) &&
                                    position >=
                                    0
                            );

                    const localNewBeats =
                        newBeats.map(
                            (
                                position
                            ) =>
                                previous.length +
                                position
                        );

                    return [
                        ...shiftedOldBeats,
                        ...localNewBeats,
                    ]
                        .filter(
                            (
                                position
                            ) =>
                                position >=
                                0 &&
                                position <
                                Math.min(
                                    256,
                                    previous.length +
                                    appendCount
                                )
                        )
                        .slice(
                            -16
                        );
                }
            );

            setWaveformSequence(
                (value) =>
                    value + 1
            );

            setLastUpdated(
                new Date()
            );

            setIsLive(true);
        };

    // ============================================================
    // BLE EMERGENCY HANDLER
    // ============================================================

    const handleBleEmergency =
        async (
            emergency
        ) => {
            if (!emergency) {
                return;
            }

            setSensorMessage(
                "Emergency event received from the MedJarvis Band."
            );

            try {
                await api.post(
                    "/emergency",
                    {
                        ...emergency,
                        bandId:
                            emergency.bandId ||
                            BAND_ID,
                    }
                );
            } catch (
            emergencyError
            ) {
                console.error(
                    "BLE EMERGENCY FORWARD ERROR:",
                    emergencyError
                );

                setError(
                    emergencyError
                        .response
                        ?.data
                        ?.message ||
                    emergencyError.message ||
                    "Unable to forward the emergency event to the backend."
                );
            }
        };

    // ============================================================
    // BLE PAGE LIFECYCLE
    // ============================================================

    useEffect(() => {
        if (
            !isWebBluetoothSupported()
        ) {
            return undefined;
        }

        return () => {
            disconnectMedJarvisBand().catch(
                (error) =>
                    console.warn(
                        "BLE cleanup warning:",
                        error
                    )
            );
        };
    }, []);

    // ============================================================
    // BLE MODAL
    // ============================================================

    const openBleModal =
        () => {
            setBleError("");

            setBleModalOpen(
                true
            );
        };

    const closeBleModal =
        () => {
            if (
                bleScanning ||
                bleConnecting
            ) {
                return;
            }

            setBleModalOpen(
                false
            );

            setBleError("");
        };

    // ============================================================
    // BLE SCAN
    //
    // This only opens the browser BLE chooser.
    // It does NOT connect to the ESP32.
    // ============================================================

    const scanForBand =
        async () => {
            setBleError("");
            setBleScanning(
                true
            );

            try {
                const device =
                    await scanForMedJarvisBand();

                setBleCandidate(
                    device
                );

                setBleBandId(
                    device.name ||
                    "MedJarvis Band"
                );
            } catch (err) {
                /*
                 * User closing the native chooser is not a real
                 * application error.
                 */

                if (
                    err?.name !==
                    "NotFoundError"
                ) {
                    setBleError(
                        err.message ||
                        "Unable to scan for the MedJarvis Band."
                    );
                }
            } finally {
                setBleScanning(
                    false
                );
            }
        };

    // ============================================================
    // BLE CONNECT
    //
    // This is the point where the GATT connection is actually
    // established, only after the user explicitly presses
    // "Connect Band".
    // ============================================================

    const connectToBand =
        async () => {
            if (
                !bleCandidate
            ) {
                return;
            }

            setBleError("");
            setBleConnecting(
                true
            );

            try {
                const result =
                    await connectMedJarvisBand(
                        bleCandidate,
                        {
                            onConnected:
                                ({
                                    bandId,
                                }) => {
                                    if (
                                        bandId
                                    ) {
                                        setBleBandId(
                                            bandId
                                        );
                                    }

                                    setBleConnected(
                                        true
                                    );
                                },

                            onAuthorized:
                                (
                                    authData
                                ) => {
                                    if (
                                        authData?.authorized
                                    ) {
                                        setBleAuthorized(
                                            true
                                        );

                                        setBleError(
                                            ""
                                        );
                                    }
                                },

                            onStatus:
                                handleBleStatus,

                            onVitals:
                                handleBleVitals,

                            onPPG:
                                handleBlePPG,

                            onEmergency:
                                handleBleEmergency,

                            onDisconnected:
                                () => {
                                    setBleConnected(
                                        false
                                    );

                                    setBleAuthorized(
                                        false
                                    );

                                    setBleCandidate(
                                        null
                                    );

                                    setBleBandId(
                                        ""
                                    );

                                    if (
                                        monitoringActive
                                    ) {
                                        setMonitoringActive(
                                            false
                                        );

                                        setRemainingSeconds(
                                            null
                                        );

                                        setSensorStatus(
                                            "SESSION_STOPPED"
                                        );

                                        setSensorMessage(
                                            "The MedJarvis Band disconnected. Monitoring has stopped."
                                        );
                                    }
                                },
                        }
                    );

                if (
                    result?.bandId
                ) {
                    setBleBandId(
                        result.bandId
                    );
                }

                setBleConnected(
                    true
                );

                setBleAuthorized(
                    true
                );

                setBleModalOpen(
                    false
                );

                setSensorMessage(
                    "MedJarvis Band connected and authorized. Ready to monitor."
                );

                setError("");
            } catch (err) {
                setBleConnected(
                    false
                );

                setBleAuthorized(
                    false
                );

                setBleError(
                    err.message ||
                    "Unable to connect to the MedJarvis Band."
                );
            } finally {
                setBleConnecting(
                    false
                );
            }
        };

    // ============================================================
    // BLE DISCONNECT
    // ============================================================

    const disconnectBand =
        async () => {
            if (
                monitoringActive
            ) {
                setError(
                    "Stop monitoring before disconnecting the MedJarvis Band."
                );

                return;
            }

            await disconnectMedJarvisBand();

            setBleConnected(
                false
            );

            setBleAuthorized(
                false
            );

            setBleCandidate(
                null
            );

            setBleBandId(
                ""
            );

            setBleModalOpen(
                false
            );
        };

    const activeMonitoring =
        monitoringActive &&
        ![
            "SESSION_COMPLETE",
            "SESSION_STOPPED",
        ].includes(
            sensorStatus
        );

    // ============================================================
    // VALIDATION HELPERS
    // ============================================================

    const hasValidHR =
        Number.isFinite(
            Number(
                displayVital?.heartRate
            )
        ) &&
        Number(
            displayVital?.heartRate
        ) >= 40 &&
        Number(
            displayVital?.heartRate
        ) <= 180;

    const hasValidSpO2 =
        Number.isFinite(
            Number(
                displayVital?.spo2
            )
        ) &&
        Number(
            displayVital?.spo2
        ) >= 70 &&
        Number(
            displayVital?.spo2
        ) <= 100;

    const hasValidTemperature =
        Number.isFinite(
            Number(
                displayVital?.temperature
            )
        );

    const hasValidSignalQuality =
        Number.isFinite(
            Number(
                displayVital?.signalQuality
            )
        );

    const hasValidHRV =
        Number.isFinite(
            Number(
                displayVital?.hrvSDNN
            )
        );

    const hasValidTilt =
        Number.isFinite(
            Number(
                displayVital?.tilt
            )
        );

    const hasValidAcceleration =
        Number.isFinite(
            Number(
                displayVital?.accelMagnitude
            )
        );

    const hasValidGyroscope =
        Number.isFinite(
            Number(
                displayVital?.gyroMagnitude
            )
        );

    const formatNumber = (
        value,
        decimals = 0
    ) => {
        const numeric =
            Number(value);

        return Number.isFinite(
            numeric
        )
            ? numeric.toFixed(
                decimals
            )
            : "—";
    };

    const getLastUpdatedText =
        () => {
            if (!lastUpdated) {
                return "Waiting for sensor data";
            }

            const seconds =
                Math.floor(
                    (Date.now() -
                        lastUpdated.getTime()) /
                    1000
                );

            if (seconds < 1) {
                return "Updated just now";
            }

            return `Updated ${seconds} sec ago`;
        };

    // ============================================================
    // UI
    // ============================================================

    return (
        <div className="h-full min-h-0 overflow-hidden text-gray-900 dark:text-slate-100">
            <style>{`
                @keyframes softPulse {
                    0%, 100% {
                        transform: scale(1);
                        opacity: 1;
                    }

                    50% {
                        transform: scale(1.08);
                        opacity: .82;
                    }
                }

                @keyframes loadingDot {
                    0%, 70%, 100% {
                        transform: translateY(0);
                        opacity: .35;
                    }

                    35% {
                        transform: translateY(-6px);
                        opacity: 1;
                    }
                }

                .loading-dot {
                    display: inline-block;
                    font-weight: 900;
                    line-height: .7;
                    animation: loadingDot 1.05s ease-in-out infinite;
                }

                .loading-dot-1 {
                    animation-delay: 0s;
                }

                .loading-dot-2 {
                    animation-delay: .16s;
                }

                .loading-dot-3 {
                    animation-delay: .32s;
                }

                @keyframes waveformGlow {
                    0%, 100% {
                        opacity: .78;
                    }

                    50% {
                        opacity: 1;
                    }
                }

                .waveform-line {
                    animation: waveformGlow 1.5s ease-in-out infinite;
                }
            `}</style>

            <div className="h-full min-h-0 overflow-y-auto xl:overflow-y-auto xl:overflow-x-hidden">
                <div className="mx-auto flex min-h-full w-full max-w-[1600px] flex-col gap-3 pb-3">

                    {/* ==================================================
                        HEADER
                    ================================================== */}

                    <div className="flex shrink-0 items-center justify-between gap-4 px-1">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100">
                                My Health
                            </h1>

                            <p className="mt-0.5 text-sm text-gray-600 dark:text-slate-400">
                                Monitor and view your latest health and sensor readings.
                            </p>
                        </div>

                        <div className="flex items-center gap-2">

                            {/* Existing Socket.IO connection indicator */}
                            <div className="hidden items-center gap-2 rounded-xl border border-[#E8E0D5] dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-4 py-2 shadow-sm sm:flex">
                                <span
                                    className={`h-2.5 w-2.5 rounded-full ${isLive
                                            ? "bg-green-500 animate-pulse"
                                            : "bg-gray-300 dark:bg-slate-600"
                                        }`}
                                />

                                <div>
                                    <p className="text-[11px] font-semibold text-gray-700 dark:text-slate-200">
                                        {isLive
                                            ? "Live connection"
                                            : "Waiting for sensor"}
                                    </p>

                                    <p className="text-[10px] text-gray-600 dark:text-slate-400">
                                        {getLastUpdatedText()}
                                    </p>
                                </div>
                            </div>

                            {/* ==================================================
                                NEW BLE CONNECT BUTTON
                            ================================================== */}

                            <button
                                type="button"
                                onClick={
                                    bleConnected
                                        ? disconnectBand
                                        : openBleModal
                                }
                                disabled={
                                    monitoringActive &&
                                    bleConnected
                                }
                                className={`flex h-10 items-center gap-2 rounded-xl px-3.5 text-xs font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${bleConnected
                                        ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                        : "bg-[#0E9F88] text-white hover:bg-[#0B8B77]"
                                    }`}
                            >
                                <span
                                    className={`h-2 w-2 rounded-full ${bleConnected &&
                                            bleAuthorized
                                            ? "bg-emerald-500 animate-pulse"
                                            : "bg-white/80"
                                        }`}
                                />

                                {bleConnected
                                    ? `Band Connected${bleBandId
                                        ? ` • ${bleBandId}`
                                        : ""
                                    }`
                                    : "Connect MedJarvis Band"}
                            </button>
                        </div>
                    </div>

                    {!patientId &&
                        !loading && (
                            <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-white dark:bg-slate-900 p-6">
                                <p className="font-medium text-red-600 dark:text-red-400">
                                    {error}
                                </p>
                            </div>
                        )}

                    {loading && (
                        <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-[#E8E0D5] dark:border-slate-800 bg-white dark:bg-slate-900">
                            <div className="text-center">
                                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#D8F3DC] border-t-[#2D6A4F]" />

                                <p className="text-sm text-gray-600 dark:text-slate-400">
                                    Loading your health monitoring panel...
                                </p>
                            </div>
                        </div>
                    )}

                    {patientId &&
                        !loading && (
                            <>
                                {/* ==================================================
                                    HEALTH MONITORING
                                ================================================== */}

                                <section className="shrink-0 rounded-2xl bg-[#12384A] p-3 text-white shadow-sm">
                                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center">

                                        <div className="shrink-0 xl:w-[240px]">
                                            <div className="flex items-center gap-2">
                                                <Activity
                                                    size={19}
                                                    className="text-[#D8F3DC]"
                                                />

                                                <div>
                                                    <h2 className="text-base font-semibold">
                                                        Health Monitoring
                                                    </h2>

                                                    <p className="text-[11px] text-white/80">
                                                        Choose a monitoring mode and start your sensor.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">

                                            <ModeButton
                                                selected={
                                                    selectedMode ===
                                                    "spot"
                                                }
                                                disabled={
                                                    monitoringActive ||
                                                    starting
                                                }
                                                onClick={() =>
                                                    setSelectedMode(
                                                        "spot"
                                                    )
                                                }
                                                icon={
                                                    <Timer
                                                        size={21}
                                                    />
                                                }
                                                title="Spot Monitoring"
                                                description="One 60-second measurement with a final validated result."
                                                selectedClass="bg-[#F1F8F3] text-[#163B2D]"
                                            />

                                            <ModeButton
                                                selected={
                                                    selectedMode ===
                                                    "continuous"
                                                }
                                                disabled={
                                                    monitoringActive ||
                                                    starting
                                                }
                                                onClick={() =>
                                                    setSelectedMode(
                                                        "continuous"
                                                    )
                                                }
                                                icon={
                                                    <Radio
                                                        size={21}
                                                    />
                                                }
                                                title="Continuous Monitoring"
                                                description="Live telemetry ~1 sec; HR/SpO₂/HRV refine about every 15 sec."
                                                selectedClass="bg-[#EAF5FF] text-[#163B2D]"
                                            />
                                        </div>

                                        <div className="flex shrink-0 flex-col gap-2 sm:flex-row xl:w-[250px] xl:justify-end">
                                            {!monitoringActive ? (
                                                <button
                                                    type="button"
                                                    onClick={
                                                        startMonitoring
                                                    }
                                                    disabled={
                                                        starting
                                                    }
                                                    className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0E9F88] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0B8B77] disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    <Play
                                                        size={17}
                                                        fill="currentColor"
                                                    />

                                                    {starting
                                                        ? "Starting..."
                                                        : "Start Monitoring"}
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={
                                                        stopMonitoring
                                                    }
                                                    disabled={
                                                        stopping
                                                    }
                                                    className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#D92D20] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#B42318] disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    <Square
                                                        size={16}
                                                        fill="currentColor"
                                                    />

                                                    {stopping
                                                        ? "Stopping..."
                                                        : "Stop Monitoring"}
                                                </button>
                                            )}

                                            {sensorStatus ===
                                                "MEASURING" &&
                                                remainingSeconds !==
                                                null && (
                                                    <div className="flex h-11 min-w-[94px] items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3">
                                                        <Timer
                                                            size={16}
                                                            className="text-[#D8F3DC]"
                                                        />

                                                        <span className="text-sm font-bold tabular-nums">
                                                            {
                                                                remainingSeconds
                                                            }
                                                            s
                                                        </span>
                                                    </div>
                                                )}
                                        </div>
                                    </div>

                                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <span
                                                className={`h-2 w-2 shrink-0 rounded-full ${monitoringActive
                                                        ? "bg-emerald-400 animate-pulse"
                                                        : "bg-white/35"
                                                    }`}
                                            />

                                            <p className="truncate text-[11px] text-white/75">
                                                {sensorMessage}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2 text-[10px] text-white/75">
                                            <span>
                                                {getSensorStatusTitle(
                                                    sensorStatus
                                                )}
                                            </span>

                                            {sensorMode && (
                                                <>
                                                    <span>
                                                        •
                                                    </span>

                                                    <span>
                                                        {sensorMode ===
                                                            "spot"
                                                            ? "Spot"
                                                            : "Continuous"}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </section>

                                {/* ==================================================
                                    METRIC CARDS
                                ================================================== */}

                                <section className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">

                                    <MetricCard
                                        label="Heart Rate"
                                        value={
                                            hasValidHR
                                                ? `${Math.round(
                                                    Number(
                                                        displayVital.heartRate
                                                    )
                                                )}`
                                                : "—"
                                        }
                                        unit={
                                            hasValidHR
                                                ? "BPM"
                                                : "Waiting for validated beats"
                                        }
                                        icon={
                                            <HeartPulse
                                                size={25}
                                            />
                                        }
                                        accent="red"
                                        active={
                                            activeMonitoring
                                        }
                                        waiting={
                                            activeMonitoring &&
                                            !hasValidHR
                                        }
                                    />

                                    <MetricCard
                                        label="SpO₂"
                                        value={
                                            hasValidSpO2
                                                ? `${Math.round(
                                                    Number(
                                                        displayVital.spo2
                                                    )
                                                )}`
                                                : "—"
                                        }
                                        unit={
                                            hasValidSpO2
                                                ? "%"
                                                : "Waiting for validated signal"
                                        }
                                        icon={
                                            <Waves
                                                size={25}
                                            />
                                        }
                                        accent="blue"
                                        active={
                                            activeMonitoring
                                        }
                                        waiting={
                                            activeMonitoring &&
                                            !hasValidSpO2
                                        }
                                    />

                                    <MetricCard
                                        label="Temperature"
                                        value={
                                            hasValidTemperature
                                                ? formatNumber(
                                                    displayVital.temperature,
                                                    1
                                                )
                                                : "—"
                                        }
                                        unit={
                                            hasValidTemperature
                                                ? "°C"
                                                : "Waiting for sensor"
                                        }
                                        icon={
                                            <Thermometer
                                                size={25}
                                            />
                                        }
                                        accent="amber"
                                        active={
                                            activeMonitoring
                                        }
                                        waiting={
                                            activeMonitoring &&
                                            !hasValidTemperature
                                        }
                                    />

                                    <MetricCard
                                        label="Signal Quality"
                                        value={
                                            hasValidSignalQuality
                                                ? `${Math.round(
                                                    Number(
                                                        displayVital.signalQuality
                                                    )
                                                )}`
                                                : "—"
                                        }
                                        unit={
                                            hasValidSignalQuality
                                                ? "%"
                                                : "Waiting for optical signal"
                                        }
                                        icon={
                                            <Gauge
                                                size={25}
                                            />
                                        }
                                        accent="purple"
                                        active={
                                            activeMonitoring
                                        }
                                        waiting={
                                            activeMonitoring &&
                                            !hasValidSignalQuality
                                        }
                                    />
                                </section>

                                {/* ==================================================
                                    PPG + CONFIDENCE
                                ================================================== */}

                                <section className="grid min-h-0 shrink-0 grid-cols-1 gap-3 xl:grid-cols-10">

                                    <div className="min-w-0 rounded-2xl bg-[#08283A] p-3 shadow-sm xl:col-span-7">
                                        <div className="mb-2 flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <Waves
                                                        size={18}
                                                        className="text-emerald-300"
                                                    />

                                                    <h3 className="text-sm font-semibold text-white">
                                                        Live PPG Waveform

                                                        {sensorMode && (
                                                            <span className="ml-1 text-white/75">
                                                                (
                                                                {sensorMode ===
                                                                    "spot"
                                                                    ? "Spot"
                                                                    : "Continuous"}{" "}
                                                                Mode)
                                                            </span>
                                                        )}
                                                    </h3>
                                                </div>

                                                <p className="text-[10px] text-white/75">
                                                    MAX30102 optical pulse signal • normalized display • 25 Hz
                                                </p>
                                            </div>

                                            <div className="flex shrink-0 items-center gap-3 text-right">
                                                {activeMonitoring && (
                                                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] font-semibold text-emerald-300">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                        Live
                                                    </span>
                                                )}

                                                <div className="text-[10px] text-white/75">
                                                    <p>
                                                        {ppgWaveform.length ||
                                                            0}{" "}
                                                        samples
                                                    </p>

                                                    <p>
                                                        {ppgWaveform.length
                                                            ? `${(
                                                                ppgWaveform.length /
                                                                (Number(
                                                                    displayVital?.ppgSampleRateHz
                                                                ) ||
                                                                    25)
                                                            ).toFixed(
                                                                2
                                                            )} s window`
                                                            : "Awaiting waveform"}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {ppgWaveform.length >
                                            1 ? (
                                            <div className="h-[180px] w-full sm:h-[190px] xl:h-[200px]">
                                                <PPGWaveform
                                                    samples={
                                                        ppgWaveform
                                                    }
                                                    beatPositions={
                                                        ppgBeatPositions
                                                    }
                                                    sequence={
                                                        waveformSequence
                                                    }
                                                    sampleRate={
                                                        Number(
                                                            displayVital?.ppgSampleRateHz
                                                        ) ||
                                                        25
                                                    }
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex h-[180px] flex-col items-center justify-center rounded-xl border border-white/10 bg-[#061F2D] px-5 text-center sm:h-[190px] xl:h-[200px]">
                                                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
                                                    <Waves
                                                        size={25}
                                                        className={
                                                            activeMonitoring
                                                                ? "text-emerald-300 animate-pulse"
                                                                : "text-white/30"
                                                        }
                                                    />
                                                </div>

                                                <p className="text-sm font-medium text-white/80">
                                                    {sensorStatus ===
                                                        "MEASURING" &&
                                                        sensorMode ===
                                                        "spot"
                                                        ? "Collecting the 60-second Spot measurement..."
                                                        : activeMonitoring
                                                            ? "Waiting for optical waveform samples..."
                                                            : "PPG waveform will appear when monitoring starts."}
                                                </p>

                                                <p className="mt-1 max-w-md text-[10px] leading-4 text-white/80">
                                                    {sensorMode ===
                                                        "spot"
                                                        ? "Spot acquisition is processed on the ESP32 and the final waveform is sent with the completed reading."
                                                        : "Keep your finger steady on the MAX30102 sensor while the live waveform updates."}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="min-w-0 rounded-2xl border border-[#E8E0D5] bg-white p-4 shadow-sm xl:col-span-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E5F6EA] text-[#16804C]">
                                                    <ShieldCheck
                                                        size={19}
                                                    />
                                                </div>

                                                <div>
                                                    <h3 className="text-sm font-semibold text-gray-900">
                                                        Measurement Confidence
                                                    </h3>

                                                    <p className="text-[9px] text-gray-600">
                                                        Sensor/measurement quality, not clinical accuracy.
                                                    </p>
                                                </div>
                                            </div>

                                            <ConfidenceRing
                                                value={
                                                    displayVital?.measurementConfidence
                                                }
                                            />
                                        </div>

                                        <div className="mt-4 grid grid-cols-2 gap-2">
                                            <ConfidenceBar
                                                label="SpO₂"
                                                value={
                                                    displayVital?.spo2Confidence
                                                }
                                                accent="blue"
                                            />

                                            <ConfidenceBar
                                                label="Heart Rate"
                                                value={
                                                    displayVital?.heartRateConfidence
                                                }
                                                accent="red"
                                            />

                                            <ConfidenceBar
                                                label="HRV"
                                                value={
                                                    displayVital?.hrvConfidence
                                                }
                                                accent="purple"
                                            />

                                            <ConfidenceBar
                                                label="Signal Quality"
                                                value={
                                                    displayVital?.signalQuality
                                                }
                                                accent="green"
                                            />
                                        </div>

                                        <div className="mt-3 rounded-xl bg-[#F7F9F7] px-3 py-2">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`h-2 w-2 rounded-full ${displayVital
                                                            ? "bg-emerald-500 animate-pulse"
                                                            : "bg-gray-300"
                                                        }`}
                                                />

                                                <p className="text-[10px] text-gray-600">
                                                    {displayVital
                                                        ? "Confidence values are from the current sensor reading."
                                                        : "Confidence values will appear with the first fresh sensor reading."}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* ==================================================
                                    ADDITIONAL READINGS
                                ================================================== */}

                                <section className="shrink-0 rounded-2xl border border-[#E8E0D5] bg-white p-3 shadow-sm">
                                    <div className="mb-2 flex items-center gap-2">
                                        <Activity
                                            size={16}
                                            className="text-[#2D6A4F]"
                                        />

                                        <h3 className="text-sm font-semibold text-gray-900">
                                            Additional Readings
                                        </h3>

                                        <span className="text-[10px] text-gray-600">
                                            Live from sensors
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 divide-y divide-[#E8E0D5] sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-4">

                                        <AdditionalReading
                                            label="HRV (SDNN)"
                                            value={
                                                hasValidHRV
                                                    ? `${formatNumber(
                                                        displayVital.hrvSDNN,
                                                        1
                                                    )} ms`
                                                    : "—"
                                            }
                                            icon={
                                                <Activity
                                                    size={18}
                                                />
                                            }
                                            accent="purple"
                                            active={
                                                activeMonitoring
                                            }
                                        />

                                        <AdditionalReading
                                            label="Tilt"
                                            value={
                                                hasValidTilt
                                                    ? `${formatNumber(
                                                        displayVital.tilt,
                                                        2
                                                    )}°`
                                                    : "—"
                                            }
                                            icon={
                                                <Radio
                                                    size={18}
                                                />
                                            }
                                            accent="green"
                                            active={
                                                activeMonitoring
                                            }
                                        />

                                        <AdditionalReading
                                            label="Acceleration"
                                            value={
                                                hasValidAcceleration
                                                    ? `${formatNumber(
                                                        displayVital.accelMagnitude,
                                                        2
                                                    )} m/s²`
                                                    : "—"
                                            }
                                            icon={
                                                <Activity
                                                    size={18}
                                                />
                                            }
                                            accent="amber"
                                            active={
                                                activeMonitoring
                                            }
                                        />

                                        <AdditionalReading
                                            label="Gyroscope"
                                            value={
                                                hasValidGyroscope
                                                    ? formatNumber(
                                                        displayVital.gyroMagnitude,
                                                        2
                                                    )
                                                    : "—"
                                            }
                                            icon={
                                                <RotateCcw
                                                    size={18}
                                                />
                                            }
                                            accent="blue"
                                            active={
                                                activeMonitoring
                                            }
                                        />
                                    </div>
                                </section>

                                {error && (
                                    <div className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                        {error}
                                    </div>
                                )}

                                <p className="shrink-0 pb-1 text-[10px] text-gray-600">
                                    Readings shown here are sensor measurements and are not, by themselves, a medical diagnosis.
                                </p>
                            </>
                        )}
                </div>
            </div>

            {/* ============================================================
                BLE CONNECTION MODAL
            ============================================================ */}

            {bleModalOpen && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm"
                    onMouseDown={(
                        event
                    ) => {
                        if (
                            event.target ===
                            event.currentTarget
                        ) {
                            closeBleModal();
                        }
                    }}
                >
                    <div className="w-full max-w-md rounded-2xl border border-[#E8E0D5] bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">

                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2D6A4F]">
                                    MedJarvis Wearable
                                </p>

                                <h2 className="mt-1 text-lg font-bold text-gray-900 dark:text-slate-100">
                                    Connect MedJarvis Band
                                </h2>

                                <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-slate-400">
                                    The ESP32 advertises the MedJarvis BLE service. Your browser will only connect after you select the Band and confirm Connect here.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={
                                    closeBleModal
                                }
                                disabled={
                                    bleScanning ||
                                    bleConnecting
                                }
                                className="rounded-lg px-2 py-1 text-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-slate-800"
                                aria-label="Close"
                            >
                                ×
                            </button>
                        </div>

                        {!isWebBluetoothSupported() && (
                            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-800">
                                Web Bluetooth is not available in this browser. Use Chrome/Chromium on a supported desktop or Android device.
                            </div>
                        )}

                        {isWebBluetoothSupported() && (
                            <>
                                <div className="mt-4 rounded-xl border border-[#E8E0D5] bg-[#F7F9F7] p-4 dark:border-slate-700 dark:bg-slate-800/60">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E5F6EA] text-[#16804C]">
                                            <Radio
                                                size={20}
                                            />
                                        </div>

                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-gray-900 dark:text-slate-100">
                                                {bleCandidate
                                                    ? "Band selected"
                                                    : "No Band selected"}
                                            </p>

                                            <p className="mt-0.5 truncate text-[11px] text-gray-600 dark:text-slate-400">
                                                {bleBandId ||
                                                    "Click Scan to find a powered MedJarvis Band."}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">

                                    <button
                                        type="button"
                                        onClick={
                                            scanForBand
                                        }
                                        disabled={
                                            bleScanning ||
                                            bleConnecting
                                        }
                                        className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#2D6A4F] bg-white px-4 text-sm font-semibold text-[#2D6A4F] transition hover:bg-[#F1F8F3] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900"
                                    >
                                        <Radio
                                            size={17}
                                        />

                                        {bleScanning
                                            ? "Scanning..."
                                            : "Scan for Band"}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={
                                            connectToBand
                                        }
                                        disabled={
                                            !bleCandidate ||
                                            bleScanning ||
                                            bleConnecting
                                        }
                                        className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0E9F88] px-4 text-sm font-semibold text-white transition hover:bg-[#0B8B77] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <ShieldCheck
                                            size={17}
                                        />

                                        {bleConnecting
                                            ? "Connecting..."
                                            : "Connect Band"}
                                    </button>
                                </div>

                                {bleCandidate && (
                                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] text-emerald-800">
                                        <span className="font-semibold">
                                            Selected:
                                        </span>{" "}
                                        {bleBandId}

                                        <p className="mt-1 text-emerald-700/80">
                                            Press Connect Band to establish the GATT connection and authorize the MedJarvis session.
                                        </p>
                                    </div>
                                )}

                                {bleError && (
                                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700">
                                        {bleError}
                                    </div>
                                )}

                                <p className="mt-4 text-[10px] leading-4 text-gray-500 dark:text-slate-500">
                                    Only this MedJarvis page sends the application authorization token and monitoring commands. The ESP32 does not automatically start monitoring when a BLE connection is made.
                                </p>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ================================================================
// MODE BUTTON
// ================================================================

function ModeButton({
    selected,
    disabled,
    onClick,
    icon,
    title,
    description,
    selectedClass,
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={`group flex min-h-[64px] items-center gap-3 rounded-xl border px-3 text-left transition ${selected
                    ? `border-white/70 ${selectedClass}`
                    : "border-white/20 bg-white/5 text-white hover:bg-white/10"
                } ${disabled
                    ? "cursor-not-allowed opacity-70"
                    : ""
                }`}
        >
            <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${selected
                        ? "bg-[#D8F3DC] text-[#2D6A4F]"
                        : "bg-white/10 text-white"
                    }`}
            >
                {icon}
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                        {title}
                    </p>

                    <span
                        className={`h-3 w-3 rounded-full border-2 ${selected
                                ? "border-[#1685FF] bg-white shadow-[inset_0_0_0_3px_white]"
                                : "border-white/60"
                            }`}
                    />
                </div>

                <p
                    className={`mt-0.5 text-[10px] leading-3 ${selected
                            ? "text-gray-600"
                            : "text-white/80"
                        }`}
                >
                    {description}
                </p>
            </div>
        </button>
    );
}

// ================================================================
// METRIC CARD
// ================================================================

function MetricCard({
    label,
    value,
    unit,
    icon,
    accent = "blue",
    active = false,
    waiting = false,
}) {
    const palettes = {
        red: {
            card:
                "border-[#F4D1D1] bg-[#FFF1F1]",
            icon:
                "bg-[#FFE2E2] text-[#E83F5B]",
            dot:
                "bg-[#E83F5B]",
        },

        blue: {
            card:
                "border-[#D5E4F4] bg-[#F0F7FF]",
            icon:
                "bg-[#E0EEFF] text-[#1677D2]",
            dot:
                "bg-[#1677D2]",
        },

        amber: {
            card:
                "border-[#F1DFC2] bg-[#FFF8EA]",
            icon:
                "bg-[#FFF0D0] text-[#F09A00]",
            dot:
                "bg-[#F09A00]",
        },

        purple: {
            card:
                "border-[#E4D9F5] bg-[#F8F2FF]",
            icon:
                "bg-[#EEE3FF] text-[#7C4DDB]",
            dot:
                "bg-[#7C4DDB]",
        },
    };

    const palette =
        palettes[accent] ||
        palettes.blue;

    return (
        <div
            className={`relative min-w-0 overflow-hidden rounded-2xl border px-4 py-3 shadow-sm transition-all duration-300 ${palette.card
                } ${active
                    ? "ring-1 ring-black/5"
                    : ""
                }`}
        >
            <div className="flex items-center gap-3">
                <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${palette.icon
                        } ${active
                            ? "animate-[softPulse_1.8s_ease-in-out_infinite]"
                            : ""
                        }`}
                >
                    {icon}
                </div>

                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-gray-700">
                        {label}
                    </p>

                    <div className="mt-0.5 flex min-w-0 items-baseline gap-1.5">
                        <p className="truncate text-[25px] font-bold leading-none text-gray-900">
                            {waiting ? (
                                <LoadingDots />
                            ) : (
                                value
                            )}
                        </p>

                        {!waiting &&
                            unit && (
                                <span className="truncate text-[9px] font-medium text-gray-600">
                                    {unit}
                                </span>
                            )}
                    </div>

                    <div className="mt-1 flex items-center gap-1.5">
                        <span
                            className={`h-1.5 w-1.5 rounded-full ${active
                                    ? `${palette.dot} animate-pulse`
                                    : "bg-gray-300"
                                }`}
                        />

                        <span className="truncate text-[9px] text-gray-600">
                            {waiting
                                ? "Measuring..."
                                : value ===
                                    "—"
                                    ? "No reading yet"
                                    : "Current sensor reading"}
                        </span>
                    </div>
                </div>

                <div
                    className={`hidden h-12 w-12 shrink-0 items-center justify-center rounded-full ${palette.icon
                        } sm:flex ${active
                            ? "animate-[softPulse_1.8s_ease-in-out_infinite]"
                            : ""
                        }`}
                >
                    {icon}
                </div>
            </div>
        </div>
    );
}

// ================================================================
// LOADING DOTS
// ================================================================

function LoadingDots() {
    return (
        <span
            className="inline-flex items-end gap-[3px]"
            aria-label="Reading in progress"
        >
            <span className="loading-dot loading-dot-1">
                .
            </span>

            <span className="loading-dot loading-dot-2">
                .
            </span>

            <span className="loading-dot loading-dot-3">
                .
            </span>
        </span>
    );
}

// ================================================================
// CONFIDENCE RING
// ================================================================

function ConfidenceRing({
    value,
}) {
    const numeric =
        Number(value);

    const valid =
        Number.isFinite(
            numeric
        );

    const percent = valid
        ? Math.max(
            0,
            Math.min(
                100,
                numeric
            )
        )
        : 0;

    const radius = 15;

    const circumference =
        2 *
        Math.PI *
        radius;

    const offset =
        circumference -
        (percent / 100) *
        circumference;

    return (
        <div className="relative h-12 w-12 shrink-0">
            <svg
                viewBox="0 0 40 40"
                className="h-12 w-12 -rotate-90"
            >
                <circle
                    cx="20"
                    cy="20"
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="text-gray-200"
                />

                <circle
                    cx="20"
                    cy="20"
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    className="text-[#1D9A60] transition-all duration-700"
                    strokeDasharray={
                        circumference
                    }
                    strokeDashoffset={
                        offset
                    }
                />
            </svg>

            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-800">
                {valid
                    ? `${Math.round(
                        percent
                    )}%`
                    : "—"}
            </span>
        </div>
    );
}

// ================================================================
// CONFIDENCE BAR
// ================================================================

function ConfidenceBar({
    label,
    value,
    accent = "green",
}) {
    const numeric =
        Number(value);

    const valid =
        Number.isFinite(
            numeric
        );

    const percent = valid
        ? Math.max(
            0,
            Math.min(
                100,
                numeric
            )
        )
        : 0;

    const bars = {
        blue:
            "bg-[#1677D2]",

        red:
            "bg-[#E83F5B]",

        purple:
            "bg-[#7C4DDB]",

        green:
            "bg-[#16804C]",
    };

    return (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-2.5">
            <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-medium text-gray-600">
                    {label}
                </span>

                <span className="text-[11px] font-bold text-gray-800">
                    {valid
                        ? `${Math.round(
                            percent
                        )}%`
                        : "—"}
                </span>
            </div>

            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200">
                <div
                    className={`h-full rounded-full transition-all duration-700 ${bars[accent] ||
                        bars.green
                        }`}
                    style={{
                        width: `${percent}%`,
                    }}
                />
            </div>
        </div>
    );
}

// ================================================================
// ADDITIONAL READING
// ================================================================

function AdditionalReading({
    label,
    value,
    icon,
    accent = "blue",
    active = false,
}) {
    const accents = {
        purple:
            "text-[#7C4DDB] bg-[#F1E9FF]",

        green:
            "text-[#16804C] bg-[#E5F6EA]",

        amber:
            "text-[#E28A00] bg-[#FFF0D0]",

        blue:
            "text-[#1677D2] bg-[#E0EEFF]",
    };

    return (
        <div className="flex min-w-0 items-center gap-3 px-3 py-2.5 sm:px-4">
            <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${accents[accent] ||
                    accents.blue
                    } ${active
                        ? "animate-[softPulse_1.8s_ease-in-out_infinite]"
                        : ""
                    }`}
            >
                {icon}
            </div>

            <div className="min-w-0">
                <p className="text-[9px] font-medium text-gray-600">
                    {label}
                </p>

                <p className="truncate text-[14px] font-bold text-gray-900">
                    {value}
                </p>
            </div>
        </div>
    );
}

// ================================================================
// PPG WAVEFORM
// ================================================================

function PPGWaveform({
    samples,
    beatPositions = [],
    sequence,
    sampleRate = 25,
}) {
    const width = 1000;
    const height = 320;

    const left = 55;
    const right = 18;
    const top = 18;
    const bottom = 42;

    const numericSamples =
        Array.isArray(samples)
            ? samples
                .map(Number)
                .filter(
                    Number.isFinite
                )
            : [];

    if (
        numericSamples.length <
        2
    ) {
        return null;
    }

    /*
     * The ESP32 values are real raw IR samples.
     *
     * For presentation we apply only a small display transform:
     * light smoothing removes sample noise,
     * then linear baseline correction removes slow DC drift.
     *
     * This does not change the ESP32 sensor processing.
     */

    const smoothWindow = 9;

    const smoothHalfWindow =
        Math.floor(
            smoothWindow / 2
        );

    const smoothedSamples =
        numericSamples.map(
            (
                sample,
                index
            ) => {
                const start =
                    Math.max(
                        0,
                        index -
                        smoothHalfWindow
                    );

                const end =
                    Math.min(
                        numericSamples.length,
                        index +
                        smoothHalfWindow +
                        1
                    );

                let total = 0;

                for (
                    let i = start;
                    i < end;
                    i++
                ) {
                    total +=
                        numericSamples[
                        i
                        ];
                }

                return (
                    total /
                    Math.max(
                        end - start,
                        1
                    )
                );
            }
        );

    const firstSample =
        smoothedSamples[0];

    const lastSample =
        smoothedSamples[
        smoothedSamples.length -
        1
        ];

    const displaySamples =
        smoothedSamples.map(
            (
                sample,
                index
            ) => {
                const progress =
                    index /
                    Math.max(
                        smoothedSamples.length -
                        1,
                        1
                    );

                const baseline =
                    firstSample +
                    (lastSample -
                        firstSample) *
                    progress;

                return (
                    sample -
                    baseline
                );
            }
        );

    const sortedDisplaySamples =
        [
            ...displaySamples,
        ].sort(
            (a, b) =>
                a - b
        );

    const percentile = (
        values,
        ratio
    ) => {
        if (!values.length) {
            return 0;
        }

        const index =
            (values.length - 1) *
            ratio;

        const lower =
            Math.floor(index);

        const upper =
            Math.ceil(index);

        if (
            lower ===
            upper
        ) {
            return values[
                lower
            ];
        }

        return (
            values[lower] +
            (values[upper] -
                values[lower]) *
            (index -
                lower)
        );
    };

    const displayMinimum =
        percentile(
            sortedDisplaySamples,
            0.05
        );

    const displayMaximum =
        percentile(
            sortedDisplaySamples,
            0.95
        );

    const displayRange =
        Math.max(
            displayMaximum -
            displayMinimum,
            1
        );

    const minimum =
        displayMinimum;

    const maximum =
        displayMaximum;

    const range =
        displayRange;

    const plotWidth =
        width -
        left -
        right;

    const plotHeight =
        height -
        top -
        bottom;

    const points =
        displaySamples.map(
            (
                sample,
                index
            ) => ({
                x:
                    left +
                    (index /
                        Math.max(
                            numericSamples.length -
                            1,
                            1
                        )) *
                    plotWidth,

                y:
                    top +
                    (1 -
                        Math.max(
                            0,
                            Math.min(
                                1,
                                (sample -
                                    minimum) /
                                range
                            )
                        )) *
                    plotHeight,
            })
        );

    const polylinePoints =
        points
            .map(
                (
                    point
                ) =>
                    `${point.x.toFixed(
                        1
                    )},${point.y.toFixed(
                        1
                    )}`
            )
            .join(" ");

    const safeSampleRate =
        Number.isFinite(
            Number(
                sampleRate
            )
        ) &&
            Number(
                sampleRate
            ) > 0
            ? Number(
                sampleRate
            )
            : 25;

    const sampleDuration =
        numericSamples.length /
        safeSampleRate;

    const validBeatPositions =
        Array.isArray(
            beatPositions
        )
            ? beatPositions
                .map(Number)
                .filter(
                    (
                        position
                    ) =>
                        Number.isInteger(
                            position
                        ) &&
                        position >=
                        0 &&
                        position <
                        points.length
                )
            : [];

    return (
        <div className="h-full w-full overflow-hidden rounded-xl border border-white/10 bg-[#061F2D]">
            <svg
                key={sequence}
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="none"
                className="h-full w-full"
                role="img"
                aria-label="Live MAX30102 PPG waveform with time and amplitude axes"
            >
                {Array.from({
                    length: 5,
                }).map(
                    (
                        _,
                        index
                    ) => {
                        const x =
                            left +
                            (index /
                                4) *
                            plotWidth;

                        return (
                            <line
                                key={`vx-${index}`}
                                x1={x}
                                y1={top}
                                x2={x}
                                y2={
                                    top +
                                    plotHeight
                                }
                                stroke="white"
                                strokeWidth="1"
                                opacity="0.08"
                            />
                        );
                    }
                )}

                {Array.from({
                    length: 5,
                }).map(
                    (
                        _,
                        index
                    ) => {
                        const y =
                            top +
                            (index /
                                4) *
                            plotHeight;

                        return (
                            <line
                                key={`hy-${index}`}
                                x1={left}
                                y1={y}
                                x2={
                                    left +
                                    plotWidth
                                }
                                y2={y}
                                stroke="white"
                                strokeWidth="1"
                                opacity="0.08"
                            />
                        );
                    }
                )}

                <line
                    x1={left}
                    y1={
                        top +
                        plotHeight
                    }
                    x2={
                        left +
                        plotWidth
                    }
                    y2={
                        top +
                        plotHeight
                    }
                    stroke="white"
                    strokeWidth="1"
                    opacity="0.4"
                />

                <line
                    x1={left}
                    y1={top}
                    x2={left}
                    y2={
                        top +
                        plotHeight
                    }
                    stroke="white"
                    strokeWidth="1"
                    opacity="0.4"
                />

                <polyline
                    points={
                        polylinePoints
                    }
                    fill="none"
                    stroke="#42F5B6"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    className="waveform-line"
                />

                {validBeatPositions.map(
                    (
                        position,
                        index
                    ) => {
                        const point =
                            points[
                            position
                            ];

                        return (
                            <g
                                key={`beat-${position}-${index}`}
                            >
                                <circle
                                    cx={
                                        point.x
                                    }
                                    cy={
                                        point.y
                                    }
                                    r="7"
                                    fill="#24E69B"
                                    opacity="0.14"
                                />

                                <circle
                                    cx={
                                        point.x
                                    }
                                    cy={
                                        point.y
                                    }
                                    r="3.2"
                                    fill="#24E69B"
                                />
                            </g>
                        );
                    }
                )}

                {Array.from({
                    length: 5,
                }).map(
                    (
                        _,
                        index
                    ) => {
                        const x =
                            left +
                            (index /
                                4) *
                            plotWidth;

                        const seconds =
                            (sampleDuration *
                                index) /
                            4;

                        return (
                            <text
                                key={`xt-${index}`}
                                x={x}
                                y={
                                    height -
                                    19
                                }
                                textAnchor="middle"
                                fill="rgba(255,255,255,0.48)"
                                fontSize="11"
                            >
                                {seconds.toFixed(
                                    2
                                )}
                                s
                            </text>
                        );
                    }
                )}

                {Array.from({
                    length: 5,
                }).map(
                    (
                        _,
                        index
                    ) => {
                        const y =
                            top +
                            (index /
                                4) *
                            plotHeight;

                        const value =
                            100 -
                            index *
                            25;

                        return (
                            <text
                                key={`yt-${index}`}
                                x={
                                    left -
                                    8
                                }
                                y={
                                    y + 4
                                }
                                textAnchor="end"
                                fill="rgba(255,255,255,0.62)"
                                fontSize="10"
                            >
                                {value}%
                            </text>
                        );
                    }
                )}

                <text
                    x={
                        left +
                        plotWidth /
                        2
                    }
                    y={
                        height -
                        4
                    }
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.42)"
                    fontSize="11"
                >
                    Time (seconds)
                </text>

                <text
                    x="13"
                    y={
                        top +
                        plotHeight /
                        2
                    }
                    textAnchor="middle"
                    transform={`rotate(-90 13 ${top +
                        plotHeight /
                        2
                        })`}
                    fill="rgba(255,255,255,0.42)"
                    fontSize="10"
                >
                    Relative PPG amplitude
                </text>
            </svg>
        </div>
    );
}

// ================================================================
// SENSOR STATUS TITLE
// ================================================================

function getSensorStatusTitle(
    status
) {
    const titles = {
        STARTING:
            "Starting",

        SENSOR_READY:
            "Sensors Ready",

        WAITING_FOR_FINGER:
            "Waiting for Finger",

        FINGER_DETECTED:
            "Finger Detected",

        STABILIZING:
            "Stabilizing",

        SIGNAL_STABLE:
            "Signal Stable",

        MEASURING:
            "Reading",

        READING_COMPLETE:
            "Reading Complete",

        FINGER_REMOVED:
            "Finger Removed",

        SESSION_COMPLETE:
            "Monitoring Complete",

        STOPPING:
            "Stopping",

        SESSION_STOPPED:
            "Monitoring Stopped",

        SENSOR_ERROR:
            "Sensor Error",

        COMMUNICATION_ERROR:
            "Communication Error",
    };

    return (
        titles[status] ||
        "Ready"
    );
}

// ================================================================
// SIGNAL QUALITY
// ================================================================

function getSignalQualityMessage(
    quality
) {
    const value =
        Number(quality);

    if (
        !Number.isFinite(
            value
        ) ||
        value <= 0
    ) {
        return "No finger contact — place your finger fully on the MAX30102 sensor.";
    }

    if (value < 35) {
        return "Weak contact — gently reposition your finger.";
    }

    if (value < 70) {
        return "Finger detected — hold still for a stronger signal.";
    }

    if (value < 90) {
        return "Good signal — keep your finger steady.";
    }

    return "Excellent optical contact — signal is strong and stable.";
}