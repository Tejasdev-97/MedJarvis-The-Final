/**
 * MedJarvis Emergency Overlay
 *
 * SINGLE persistent emergency card that listens globally for fall alerts
 * from the ESP32 via Socket.IO and manages the full emergency state machine:
 *
 * IDLE
 * → DETECTED  (fallAlert socket event received)
 * → LISTENING (after TTS finishes speaking)
 * → DECLARED  (user pressed Emergency / said Emergency / timeout)
 * → CALLING   (SMS sent, initiating call)
 * → ACTIVE    (call initiated, emergency live)
 * → RESOLVED  (user pressed "I'M SAFE")
 * → CANCELLED (user pressed X before declaration)
 *
 * This component mounts globally inside DashboardLayout and is always
 * available regardless of which page the user is on.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import api from "../services/api";

// ================================================================
// CONSTANTS
// ================================================================

const BAND_ID = "BAND-MJ-001";

const DETECTED_TIMEOUT_SECONDS = 8;   // TTS + countdown before LISTENING
const LISTENING_TIMEOUT_SECONDS = 10; // Mic window before auto-declare

const SOCKET_URL =
    import.meta.env.VITE_API_URL?.replace("/api", "") ||
    "http://localhost:5000";

// ================================================================
// HELPERS
// ================================================================

function speak(text, onEnd) {
    if (!window.speechSynthesis) {
        if (onEnd) onEnd();
        return;
    }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.92;
    utt.pitch = 1.0;
    utt.volume = 1.0;
    if (onEnd) utt.onend = onEnd;
    window.speechSynthesis.speak(utt);
}

function stopSpeech() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
}

// ================================================================
// MAIN COMPONENT
// ================================================================

export default function EmergencyOverlay() {
    const profile = JSON.parse(localStorage.getItem("profile") || "null");
    const patientId =
        typeof profile?.patient === "object"
            ? profile?.patient?._id
            : profile?.patient;

    // ── State machine ──────────────────────────────────────────
    const [phase, setPhase] = useState("IDLE");
    // IDLE | DETECTED | LISTENING | DECLARED | CALLING | ACTIVE | RESOLVED | CANCELLED

    // ── Fall data from socket ──────────────────────────────────
    const [fallData, setFallData] = useState(null);

    // ── Emergency event returned from backend ──────────────────
    const [emergencyEvent, setEmergencyEvent] = useState(null);
    const [patientInfo, setPatientInfo] = useState(null);
    const [emergencyContact, setEmergencyContact] = useState("");

    // ── Timers ─────────────────────────────────────────────────
    const [countdown, setCountdown] = useState(DETECTED_TIMEOUT_SECONDS);

    // ── Voice / Mic ────────────────────────────────────────────
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isMicOn, setIsMicOn] = useState(false);
    const [voiceTranscript, setVoiceTranscript] = useState("");
    const [voiceUnknown, setVoiceUnknown] = useState(false);

    // ── SMS / Call status ──────────────────────────────────────
    const [smsStatus, setSmsStatus] = useState("not_sent");
    const [callStatus, setCallStatus] = useState("not_initiated");
    const [callSeconds, setCallSeconds] = useState(0);

    // ── Declaring in progress ──────────────────────────────────
    const [declaring, setDeclaring] = useState(false);
    const [declareError, setDeclareError] = useState("");

    // ── Resolving in progress ─────────────────────────────────
    const [resolving, setResolving] = useState(false);

    // ── Refs ───────────────────────────────────────────────────
    const phaseRef = useRef("IDLE");
    const countdownRef = useRef(null);
    const callTimerRef = useRef(null);
    const recognitionRef = useRef(null);
    const socketRef = useRef(null);
    const fallDataRef = useRef(null);
    // Ref that always holds the latest triggerDetected fn (avoids stale closure
    // in the socket useEffect which runs once and would capture an old value)
    const triggerDetectedRef = useRef(null);

    const updatePhase = useCallback((newPhase) => {
        phaseRef.current = newPhase;
        setPhase(newPhase);
    }, []);

    // ================================================================
    // SOCKET.IO — connect globally and listen for fallAlert
    // ================================================================

    useEffect(() => {
        if (!patientId) return;

        console.log("🔌 EmergencyOverlay: connecting socket for patient", patientId);
        const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
        socketRef.current = socket;

        socket.on("connect", () => {
            console.log("✅ EmergencyOverlay socket connected:", socket.id);
            socket.emit("joinPatient", patientId);
        });

        socket.on("connect_error", (err) => {
            console.warn("⚠️ EmergencyOverlay socket connect_error:", err.message);
        });

        socket.on("fallAlert", (data) => {
            console.log("🚨 fallAlert received raw:", data);
            // Only trigger if we are in IDLE (one emergency at a time)
            if (phaseRef.current !== "IDLE") {
                console.log("⚠️ fallAlert ignored — phase is:", phaseRef.current);
                return;
            }

            fallDataRef.current = data;
            setFallData(data);
            // Use ref so we always call the latest triggerDetected (avoids stale closure)
            if (triggerDetectedRef.current) {
                triggerDetectedRef.current(data);
            }
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patientId]);

    // ================================================================
    // PHASE: DETECTED
    // ================================================================

    const triggerDetected = useCallback((data) => {
        console.log("🚨 triggerDetected called, phase:", phaseRef.current);
        stopSpeech();
        stopMic();
        clearAllTimers();

        updatePhase("DETECTED");
        setFallData(data);
        setCountdown(DETECTED_TIMEOUT_SECONDS);
        setVoiceTranscript("");
        setVoiceUnknown(false);
        setDeclareError("");
        setEmergencyEvent(null);
        setPatientInfo(null);
        setSmsStatus("not_sent");
        setCallStatus("not_initiated");
        setCallSeconds(0);
        setDeclaring(false);
        setResolving(false);
        setIsSpeaking(true);
        setIsMicOn(false);

        // TTS
        speak(
            "Possible emergency detected! A fall-like movement was recorded from your band. Are you okay? Say I'm OK or Emergency, or use the buttons below.",
            () => {
                setIsSpeaking(false);
                // After TTS, transition to LISTENING if still in DETECTED
                if (phaseRef.current === "DETECTED") {
                    startListening();
                }
            }
        );

        // Start countdown
        startCountdown(DETECTED_TIMEOUT_SECONDS, () => {
            // On timeout from DETECTED — go to LISTENING if TTS already done
            if (phaseRef.current === "DETECTED") {
                setIsSpeaking(false);
                stopSpeech();
                startListening();
            }
        });
    }, [updatePhase]); // eslint-disable-line react-hooks/exhaustive-deps

    // Keep the ref in sync so the socket handler always calls the latest version
    useEffect(() => {
        triggerDetectedRef.current = triggerDetected;
    }, [triggerDetected]);

    // ================================================================
    // PHASE: LISTENING
    // ================================================================

    const startListening = useCallback(() => {
        if (phaseRef.current === "CANCELLED" || phaseRef.current === "RESOLVED") return;

        updatePhase("LISTENING");
        setCountdown(LISTENING_TIMEOUT_SECONDS);
        setIsMicOn(true);
        setIsSpeaking(false);

        // Start mic
        activateMic();

        // Countdown — auto-declare on timeout
        startCountdown(LISTENING_TIMEOUT_SECONDS, () => {
            if (phaseRef.current === "LISTENING") {
                console.log("⏰ No response — auto declaring emergency");
                handleDeclare("timeout");
            }
        });
    }, [updatePhase]); // eslint-disable-line react-hooks/exhaustive-deps

    // ================================================================
    // COUNTDOWN
    // ================================================================

    const startCountdown = useCallback((seconds, onExpire) => {
        clearCountdown();
        setCountdown(seconds);
        let remaining = seconds;

        countdownRef.current = setInterval(() => {
            remaining -= 1;
            setCountdown(remaining);

            if (remaining <= 0) {
                clearCountdown();
                if (onExpire) onExpire();
            }
        }, 1000);
    }, []);

    const clearCountdown = useCallback(() => {
        if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
        }
    }, []);

    const clearAllTimers = useCallback(() => {
        clearCountdown();
        if (callTimerRef.current) {
            clearInterval(callTimerRef.current);
            callTimerRef.current = null;
        }
    }, [clearCountdown]);

    // ================================================================
    // MICROPHONE / VOICE RECOGNITION
    // ================================================================

    const activateMic = useCallback(() => {
        stopMic();

        const SpeechRecognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.warn("SpeechRecognition not supported");
            return;
        }

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.lang = "en-IN";
        recognition.continuous = true;
        recognition.interimResults = false;

        recognition.onresult = (event) => {
            const transcript = event.results[
                event.results.length - 1
            ][0].transcript.toLowerCase().trim();

            setVoiceTranscript(transcript);
            console.log("🎤 Voice:", transcript);

            if (
                transcript.includes("ok") ||
                transcript.includes("okay") ||
                transcript.includes("fine") ||
                transcript.includes("safe")
            ) {
                handleImOK();
            } else if (
                transcript.includes("emergency") ||
                transcript.includes("help") ||
                transcript.includes("ambulance")
            ) {
                handleDeclare("voice");
            } else {
                setVoiceUnknown(true);
                setTimeout(() => setVoiceUnknown(false), 3000);
            }
        };

        recognition.onerror = (e) => {
            console.warn("Speech recognition error:", e.error);
        };

        try {
            recognition.start();
        } catch (e) {
            console.warn("Could not start recognition:", e);
        }
    }, []);

    const stopMic = () => {
        setIsMicOn(false);
        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch (e) { /* ignore */ }
            recognitionRef.current = null;
        }
    };

    // ================================================================
    // CANCEL (X button — before declaration)
    // ================================================================

    const handleCancel = useCallback(() => {
        console.log("❌ Emergency cancelled by user (X)");
        clearAllTimers();
        stopSpeech();
        stopMic();
        updatePhase("CANCELLED");
        setFallData(null);
        fallDataRef.current = null;

        // Brief delay then back to IDLE
        setTimeout(() => {
            if (phaseRef.current === "CANCELLED") {
                updatePhase("IDLE");
            }
        }, 2000);
    }, [clearAllTimers, updatePhase]);

    // ================================================================
    // I'M OK
    // ================================================================

    const handleImOK = useCallback(() => {
        if (phaseRef.current !== "DETECTED" && phaseRef.current !== "LISTENING") return;
        console.log("✅ I'm OK — cancelling emergency");
        clearAllTimers();
        stopSpeech();
        stopMic();
        updatePhase("RESOLVED");
        setFallData(null);
        fallDataRef.current = null;

        setTimeout(() => {
            if (phaseRef.current === "RESOLVED") updatePhase("IDLE");
        }, 3000);
    }, [clearAllTimers, updatePhase]);

    // ================================================================
    // DECLARE EMERGENCY
    // ================================================================

    const handleDeclare = useCallback(async (source = "button") => {
        if (
            phaseRef.current !== "DETECTED" &&
            phaseRef.current !== "LISTENING"
        ) return;

        if (declaring) return;

        console.log("🚨 Declaring emergency, source:", source);
        clearAllTimers();
        stopSpeech();
        stopMic();
        setDeclaring(true);
        updatePhase("DECLARED");

        const fd = fallDataRef.current || fallData;

        try {
            const response = await api.post("/emergency", {
                bandId: BAND_ID,
                type: "fall",
                severity: "HIGH",
                spo2: fd?.spo2 || null,
                heartRate: fd?.heartRate || null,
                temperature: fd?.temperature || null,
                accelMagnitude: fd?.accelMagnitude || null,
                gyroMagnitude: fd?.gyroMagnitude || null,
                tilt: fd?.tilt || null,
                fallEventConfidence: fd?.fallEventConfidence || null,
            });

            const data = response.data?.data;

            if (data) {
                setEmergencyEvent(data.event);
                setPatientInfo(data.patient);
                setEmergencyContact(data.emergencyContact || data.patient?.emergencyContact || "");
                setSmsStatus(data.smsStatus || "not_sent");
                setCallStatus(data.callStatus || "not_initiated");
            }

            updatePhase("CALLING");
            setDeclaring(false);

            // Initiate actual call via tel: (real mechanism on mobile/laptop)
            const contactPhone = data?.emergencyContact || data?.patient?.emergencyContact;
            if (contactPhone) {
                setTimeout(() => {
                    window.open(`tel:${contactPhone}`, "_self");
                }, 1500);

                // Call timer
                setCallSeconds(0);
                callTimerRef.current = setInterval(() => {
                    setCallSeconds((prev) => prev + 1);
                }, 1000);

                // After 5s, transition to ACTIVE
                setTimeout(() => {
                    if (phaseRef.current === "CALLING") {
                        setCallStatus("initiated");
                        updatePhase("ACTIVE");
                    }
                }, 5000);
            } else {
                // No contact — go active anyway
                setTimeout(() => {
                    updatePhase("ACTIVE");
                }, 2000);
            }

        } catch (err) {
            console.error("Emergency declare error:", err);
            const errMsg =
                err.response?.data?.message ||
                "Unable to create emergency event. Please call manually.";

            setDeclareError(errMsg);
            setDeclaring(false);
            updatePhase("ACTIVE"); // Stay active even on error
        }
    }, [declaring, clearAllTimers, updatePhase, fallData]); // eslint-disable-line react-hooks/exhaustive-deps

    // ================================================================
    // RESOLVE — "I'M SAFE — STOP EMERGENCY"
    // ================================================================

    const handleResolve = useCallback(async () => {
        if (resolving) return;

        clearAllTimers();
        stopMic();
        setResolving(true);

        const eventId = emergencyEvent?._id;

        if (eventId) {
            try {
                await api.patch(`/emergency/${eventId}/resolve`);
            } catch (err) {
                console.error("Resolve error:", err);
            }
        }

        updatePhase("RESOLVED");
        setResolving(false);
        setFallData(null);
        fallDataRef.current = null;

        setTimeout(() => {
            if (phaseRef.current === "RESOLVED") updatePhase("IDLE");
        }, 4000);
    }, [resolving, emergencyEvent, clearAllTimers, updatePhase]);

    // ================================================================
    // CLEANUP on unmount
    // ================================================================

    useEffect(() => {
        return () => {
            clearAllTimers();
            stopSpeech();
            stopMic();
        };
    }, [clearAllTimers]);

    // ================================================================
    // CALL TIMER FORMAT
    // ================================================================

    const formatCallTime = (s) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    };

    // ================================================================
    // RENDER — IDLE means no overlay
    // ================================================================

    if (phase === "IDLE") return null;

    // ================================================================
    // RENDER — CANCELLED
    // ================================================================

    if (phase === "CANCELLED") {
        return (
            <Backdrop>
                <div style={styles.card}>
                    <div style={{ textAlign: "center", padding: "40px 24px" }}>
                        <div style={styles.iconCircle("rgba(107,114,128,0.12)")}>
                            <span style={{ fontSize: 32 }}>✕</span>
                        </div>
                        <h2 style={{ ...styles.heading, color: "#374151", marginTop: 16 }}>
                            Emergency Dismissed
                        </h2>
                        <p style={styles.subtext}>
                            Alert was cancelled before confirmation. No SMS or call was made.
                        </p>
                    </div>
                </div>
            </Backdrop>
        );
    }

    // ================================================================
    // RENDER — RESOLVED
    // ================================================================

    if (phase === "RESOLVED") {
        return (
            <Backdrop>
                <div style={styles.card}>
                    <div style={{ textAlign: "center", padding: "48px 24px" }}>
                        <div style={styles.iconCircle("rgba(22,163,74,0.12)")}>
                            <span style={{ fontSize: 36, color: "#16A34A" }}>✓</span>
                        </div>
                        <h2 style={{ ...styles.heading, color: "#15803D", marginTop: 16 }}>
                            Emergency Resolved
                        </h2>
                        <p style={{ ...styles.subtext, marginTop: 8 }}>
                            Emergency event has been marked as resolved.
                        </p>
                        <p style={{ ...styles.subtext, marginTop: 4 }}>
                            It remains available in emergency history.
                        </p>
                    </div>
                </div>
            </Backdrop>
        );
    }

    // ================================================================
    // RENDER — DETECTED
    // ================================================================

    if (phase === "DETECTED") {
        return (
            <Backdrop>
                <div style={styles.card}>
                    {/* TOP BADGE */}
                    <div style={styles.badge("bg", "#FEE2E2", "#991B1B")}>
                        <span style={styles.badgeDot("#DC2626")} />
                        <span style={{ fontSize: 13, fontWeight: 700 }}>1</span>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>  Emergency Detected</span>
                    </div>

                    {/* X CANCEL BUTTON — CRITICAL PRESENTATION SAFETY */}
                    <button
                        id="emergency-cancel-x"
                        onClick={handleCancel}
                        style={styles.xButton}
                        title="Dismiss alert (before confirmation)"
                        aria-label="Dismiss emergency alert"
                    >
                        ✕
                    </button>

                    {/* HEADER */}
                    <div style={styles.cardHeader}>
                        <div style={styles.iconCircle("#FEE2E2")}>
                            <HeartMedIcon />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <h2 style={styles.mainTitle}>
                                <span style={{ color: "#DC2626" }}>Possible Emergency</span>
                                {" "}
                                <span style={{ color: "#111827" }}>Detected</span>
                            </h2>
                            <p style={{ ...styles.bold14, marginTop: 2 }}>Possible fall detected!</p>
                            <p style={styles.subtext}>We detected an unusual movement pattern from your band.</p>
                        </div>
                    </div>

                    {/* MAIN BODY */}
                    <div style={styles.bodyRow}>
                        {/* LEFT — falling person illustration */}
                        <div style={styles.leftPanel}>
                            <FallingPersonIllustration />
                        </div>

                        {/* RIGHT — prompt + countdown */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={styles.boldPrompt}>Are you okay?</p>
                            <p style={styles.subtext}>Please respond using voice or buttons below.</p>

                            {/* Countdown */}
                            <div style={styles.countdownCircle}>
                                <span style={styles.countdownNumber}>{String(countdown).padStart(2, "0")}</span>
                                <span style={styles.countdownLabel}>seconds</span>
                            </div>

                            {/* Voice status */}
                            <div style={styles.voiceRow}>
                                <div style={styles.voiceItem}>
                                    <SpeakerIcon active={isSpeaking} />
                                    <span style={{ color: isSpeaking ? "#DC2626" : "#374151", fontWeight: 600, fontSize: 13 }}>
                                        {isSpeaking ? "Speaking..." : "Speaker: OFF"}
                                    </span>
                                    {isSpeaking && <WaveformAnim />}
                                </div>
                                <div style={styles.voiceDivider} />
                                <div style={styles.voiceItem}>
                                    <MicIcon active={false} />
                                    <span style={{ color: "#374151", fontWeight: 600, fontSize: 13 }}>Mic: OFF</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* BUTTONS */}
                    <ActionButtons
                        onOK={handleImOK}
                        onEmergency={() => handleDeclare("button")}
                        disabled={declaring}
                    />

                    {/* BOTTOM INFO */}
                    <div style={styles.infoStrip}>
                        <InfoIcon />
                        <span style={{ color: "#1E40AF", fontWeight: 600, fontSize: 13 }}>
                            "Are you okay? Say I'm OK or Emergency."
                        </span>
                    </div>
                </div>
            </Backdrop>
        );
    }

    // ================================================================
    // RENDER — LISTENING
    // ================================================================

    if (phase === "LISTENING") {
        return (
            <Backdrop>
                <div style={styles.card}>
                    {/* BADGE */}
                    <div style={styles.badge("bg", "#D1FAE5", "#065F46")}>
                        <span style={styles.badgeDot("#16A34A")} />
                        <span style={{ fontSize: 13, fontWeight: 700 }}>2</span>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>  Listening for Response</span>
                    </div>

                    {/* X CANCEL */}
                    <button
                        id="emergency-cancel-x-listening"
                        onClick={handleCancel}
                        style={styles.xButton}
                        title="Dismiss alert"
                    >
                        ✕
                    </button>

                    {/* HEADER */}
                    <div style={styles.cardHeader}>
                        <div style={styles.iconCircle("#D1FAE5")}>
                            <MicIconLarge />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <h2 style={{ ...styles.mainTitle, color: "#111827" }}>Are you okay?</h2>
                            <p style={{ ...styles.bold14, color: "#15803D", marginTop: 2 }}>I'm listening...</p>
                            <p style={styles.subtext}>Say "I'm OK" or "Emergency", or use the buttons below.</p>
                            {voiceUnknown && (
                                <p style={{ color: "#B45309", fontWeight: 600, fontSize: 13, marginTop: 4 }}>
                                    I didn't understand. Please say "I'm okay" or "Emergency".
                                </p>
                            )}
                            {voiceTranscript && !voiceUnknown && (
                                <p style={{ color: "#374151", fontSize: 13, marginTop: 4 }}>
                                    Heard: "<em>{voiceTranscript}</em>"
                                </p>
                            )}
                        </div>
                    </div>

                    {/* BODY */}
                    <div style={styles.bodyRow}>
                        {/* LEFT — mic animation */}
                        <div style={styles.leftPanel}>
                            <ListeningAnimation />
                        </div>

                        {/* RIGHT — say these */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ ...styles.bold14, marginBottom: 10 }}>Say one of these:</p>

                            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                                <div style={styles.sayChip("green")}>
                                    <span style={{ fontSize: 16 }}>✓</span> "I'm OK"
                                </div>
                                <div style={styles.sayChip("red")}>
                                    <span style={{ fontSize: 16 }}>⚠</span> "Emergency"
                                </div>
                            </div>

                            {/* Countdown */}
                            <div style={styles.countdownCircle}>
                                <span style={styles.countdownNumber}>{String(countdown).padStart(2, "0")}</span>
                                <span style={styles.countdownLabel}>seconds</span>
                            </div>

                            {/* Voice status */}
                            <div style={styles.voiceRow}>
                                <div style={styles.voiceItem}>
                                    <SpeakerIcon active={false} />
                                    <span style={{ color: "#374151", fontWeight: 600, fontSize: 13 }}>Speaker: OFF</span>
                                </div>
                                <div style={styles.voiceDivider} />
                                <div style={styles.voiceItem}>
                                    <MicIcon active={true} />
                                    <span style={{ color: "#16A34A", fontWeight: 600, fontSize: 13 }}>Mic: ON</span>
                                    <WaveformAnim color="#16A34A" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <ActionButtons
                        onOK={handleImOK}
                        onEmergency={() => handleDeclare("button")}
                        disabled={declaring}
                    />

                    <div style={styles.infoStrip}>
                        <InfoIcon />
                        <span style={{ color: "#1E40AF", fontWeight: 600, fontSize: 13 }}>
                            Listening... No response in {countdown}s will declare emergency automatically.
                        </span>
                    </div>
                </div>
            </Backdrop>
        );
    }

    // ================================================================
    // RENDER — DECLARED / CALLING / ACTIVE
    // ================================================================

    if (phase === "DECLARED" || phase === "CALLING" || phase === "ACTIVE") {
        const isDeclared = phase === "DECLARED";
        const isCalling = phase === "CALLING";
        const isActive = phase === "ACTIVE";

        const pName = patientInfo?.name || "Patient";
        const pAge = patientInfo?.age ? `Age: ${patientInfo.age} years` : "";
        const pId = patientInfo?.medJarvisId || "";
        const pPhoto = patientInfo?.photo || "";
        const eContact = emergencyContact || patientInfo?.emergencyContact || "";

        const badgeColor = isDeclared ? ["#FEF3C7", "#92400E"] :
            isCalling ? ["#FEE2E2", "#991B1B"] :
                ["#FEE2E2", "#991B1B"];

        const badgeNum = isDeclared ? "3" : isCalling ? "3" : "4";
        const badgeLabel = isDeclared ? "Emergency Declared" :
            isCalling ? "Emergency Declared" : "Emergency Active";

        return (
            <Backdrop>
                <div style={{ ...styles.card, maxWidth: 780 }}>
                    {/* BADGE */}
                    <div style={styles.badge("bg", badgeColor[0], badgeColor[1])}>
                        <span style={styles.badgeDot(isDeclared ? "#D97706" : "#DC2626")} />
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{badgeNum}</span>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>  {badgeLabel}</span>
                    </div>

                    {/* HEADER */}
                    <div style={styles.cardHeader}>
                        <div style={styles.iconCircle("#FEE2E2")}>
                            {isActive ? <HeartMedIcon /> : <AlarmIcon />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <h2 style={styles.mainTitle}>
                                {isActive ? (
                                    <>
                                        <span style={{ color: "#DC2626" }}>Emergency</span>
                                        {" "}
                                        <span style={{ color: "#111827" }}>Active</span>
                                    </>
                                ) : (
                                    <>
                                        <span style={{ color: "#DC2626" }}>Emergency</span>
                                        {" "}
                                        <span style={{ color: "#111827" }}>Declared</span>
                                    </>
                                )}
                            </h2>
                            <p style={{ ...styles.bold14, marginTop: 2 }}>
                                {isActive
                                    ? "Emergency assistance has been requested."
                                    : "Emergency event confirmed."}
                            </p>
                            <p style={styles.subtext}>
                                {isActive
                                    ? "Your emergency contact has been notified and a call has been placed."
                                    : declaring
                                        ? "Processing your emergency..."
                                        : "We are notifying your emergency contact."}
                            </p>
                            {declareError && (
                                <p style={{ color: "#B91C1C", fontWeight: 600, fontSize: 13, marginTop: 4 }}>
                                    ⚠ {declareError}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* TWO-COLUMN BODY */}
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                        {/* LEFT — patient + event info */}
                        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                            {/* Patient */}
                            <div style={styles.infoCard}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    {pPhoto ? (
                                        <img
                                            src={pPhoto}
                                            alt={pName}
                                            style={styles.patientPhoto}
                                        />
                                    ) : (
                                        <div style={styles.patientPhotoPlaceholder}>
                                            <PersonIcon />
                                        </div>
                                    )}
                                    <div>
                                        <p style={styles.bold14}>{pName}</p>
                                        {pAge && (
                                            <p style={{ color: "#374151", fontSize: 13, fontWeight: 500 }}>
                                                {pAge} {pId && `  |  ID: ${pId}`}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Event info */}
                            <div style={{ ...styles.infoCard, marginTop: 10 }}>
                                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                                    <InfoRow icon="⚠" label="Event Type" value="Possible Fall" />
                                    <InfoRow
                                        icon="🕐"
                                        label="Time"
                                        value={
                                            emergencyEvent?.declaredAt
                                                ? new Date(emergencyEvent.declaredAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
                                                : new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
                                        }
                                    />
                                </div>
                            </div>
                        </div>

                        {/* RIGHT — status panel */}
                        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                            <div style={styles.infoCard}>
                                {/* Checklist */}
                                <StatusCheck
                                    done={!!emergencyEvent}
                                    loading={declaring}
                                    label="Emergency event recorded"
                                />
                                <StatusCheck
                                    done={smsStatus === "accepted" || smsStatus === "delivered"}
                                    failed={smsStatus === "failed"}
                                    loading={declaring && smsStatus === "not_sent"}
                                    label={
                                        smsStatus === "failed"
                                            ? "SMS failed — please call manually"
                                            : "Emergency contact notified by SMS"
                                    }
                                />

                                {/* Call panel */}
                                {(isCalling || isActive) ? (
                                    <div style={{ marginTop: 12 }}>
                                        {isCalling && (
                                            <div style={styles.callPanel}>
                                                <div style={styles.callCircle}>
                                                    <PhoneIcon />
                                                </div>
                                                <div style={{ textAlign: "center" }}>
                                                    <p style={{ color: "#374151", fontWeight: 600, fontSize: 13 }}>Calling...</p>
                                                    <p style={{ color: "#111827", fontWeight: 700, fontSize: 15, marginTop: 4 }}>
                                                        Emergency Contact
                                                    </p>
                                                    {eContact && (
                                                        <p style={{ color: "#374151", fontWeight: 500, fontSize: 13 }}>
                                                            {eContact}
                                                        </p>
                                                    )}
                                                    <p style={{ color: "#374151", fontWeight: 700, fontSize: 20, marginTop: 6, fontFamily: "monospace" }}>
                                                        {formatCallTime(callSeconds)}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                        {isActive && (
                                            <>
                                                <StatusCheck done label="SMS sent to emergency contact" />
                                                <StatusCheck done label="Call placed to emergency contact" />
                                                <div style={styles.infoBox}>
                                                    <InfoIcon color="#1D4ED8" />
                                                    <div>
                                                        <p style={{ color: "#1E3A8A", fontWeight: 700, fontSize: 13 }}>
                                                            Emergency monitoring is active.
                                                        </p>
                                                        <p style={{ color: "#1E40AF", fontWeight: 500, fontSize: 12, marginTop: 2 }}>
                                                            Help is on the way. You can stop the emergency if this was a false trigger.
                                                        </p>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                                        <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #D1D5DB", borderTopColor: "#DC2626", animation: "spin 1s linear infinite" }} />
                                        <span style={{ color: "#374151", fontWeight: 600, fontSize: 13 }}>
                                            Calling emergency contact...
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* I'M SAFE BUTTON */}
                    <button
                        id="emergency-resolve-btn"
                        onClick={handleResolve}
                        disabled={resolving || declaring}
                        style={styles.safeButton}
                    >
                        <StopIcon />
                        <div>
                            <p style={{ fontWeight: 800, fontSize: 16, letterSpacing: "0.02em" }}>
                                {resolving ? "STOPPING EMERGENCY..." : "I'M SAFE — STOP EMERGENCY"}
                            </p>
                            <p style={{ fontWeight: 500, fontSize: 12, opacity: 0.88, marginTop: 2 }}>
                                Stop this emergency if this was a false trigger
                            </p>
                        </div>
                    </button>

                    {/* BOTTOM INFO */}
                    <div style={{ ...styles.infoStrip, background: "#FFFBEB", borderColor: "#FDE68A" }}>
                        <InfoIcon color="#B45309" />
                        <span style={{ color: "#92400E", fontWeight: 600, fontSize: 13 }}>
                            Emergency remains active until you stop it or help arrives.
                        </span>
                    </div>
                </div>
            </Backdrop>
        );
    }

    return null;
}

// ================================================================
// SUB-COMPONENTS
// ================================================================

function Backdrop({ children }) {
    return (
        <div
            id="emergency-backdrop"
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                background: "rgba(0,0,0,0.65)",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px",
                overflowY: "auto",
            }}
        >
            {children}
        </div>
    );
}

function ActionButtons({ onOK, onEmergency, disabled }) {
    return (
        <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button
                id="emergency-im-ok-btn"
                onClick={onOK}
                disabled={disabled}
                style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    padding: "16px 12px",
                    borderRadius: 14,
                    background: "#16A34A",
                    color: "#fff",
                    border: "none",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.6 : 1,
                    transition: "background 0.2s",
                }}
                onMouseOver={(e) => { if (!disabled) e.currentTarget.style.background = "#15803D"; }}
                onMouseOut={(e) => { if (!disabled) e.currentTarget.style.background = "#16A34A"; }}
            >
                <span style={{ fontSize: 20 }}>✓</span>
                <div style={{ textAlign: "left" }}>
                    <p style={{ fontWeight: 800, fontSize: 15, letterSpacing: "0.02em" }}>I'M OK</p>
                    <p style={{ fontWeight: 500, fontSize: 11, opacity: 0.9, marginTop: 1 }}>I am safe, this was a false alert</p>
                </div>
            </button>

            <button
                id="emergency-declare-btn"
                onClick={onEmergency}
                disabled={disabled}
                style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    padding: "16px 12px",
                    borderRadius: 14,
                    background: "#DC2626",
                    color: "#fff",
                    border: "none",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.6 : 1,
                    transition: "background 0.2s",
                }}
                onMouseOver={(e) => { if (!disabled) e.currentTarget.style.background = "#B91C1C"; }}
                onMouseOut={(e) => { if (!disabled) e.currentTarget.style.background = "#DC2626"; }}
            >
                <span style={{ fontSize: 20 }}>⚠</span>
                <div style={{ textAlign: "left" }}>
                    <p style={{ fontWeight: 800, fontSize: 15, letterSpacing: "0.02em" }}>
                        {disabled ? "DECLARING..." : "EMERGENCY"}
                    </p>
                    <p style={{ fontWeight: 500, fontSize: 11, opacity: 0.9, marginTop: 1 }}>I need help now</p>
                </div>
            </button>
        </div>
    );
}

function StatusCheck({ done, failed, loading, label }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
            {loading ? (
                <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid #D1D5DB", borderTopColor: "#DC2626", flexShrink: 0, animation: "spin 1s linear infinite" }} />
            ) : failed ? (
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ color: "#DC2626", fontSize: 12, fontWeight: 800 }}>✕</span>
                </div>
            ) : done ? (
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#D1FAE5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ color: "#16A34A", fontSize: 12, fontWeight: 800 }}>✓</span>
                </div>
            ) : (
                <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid #D1D5DB", flexShrink: 0 }} />
            )}
            <span style={{ color: failed ? "#B91C1C" : done ? "#15803D" : "#374151", fontWeight: done || failed ? 700 : 500, fontSize: 13 }}>
                {label}
            </span>
        </div>
    );
}

function InfoRow({ icon, label, value }) {
    return (
        <div style={{ minWidth: 110 }}>
            <p style={{ color: "#6B7280", fontWeight: 600, fontSize: 11, marginBottom: 2 }}>
                {icon} {label}
            </p>
            <p style={{ color: "#111827", fontWeight: 700, fontSize: 13 }}>{value}</p>
        </div>
    );
}

function WaveformAnim({ color = "#DC2626" }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: 4 }}>
            {[4, 8, 12, 8, 5, 10, 7].map((h, i) => (
                <div
                    key={i}
                    style={{
                        width: 2,
                        height: h,
                        background: color,
                        borderRadius: 2,
                        animation: `wave ${0.6 + i * 0.1}s ease-in-out infinite alternate`,
                    }}
                />
            ))}
        </div>
    );
}

function ListeningAnimation() {
    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
            {/* Ripple circles */}
            <div style={{ position: "relative", width: 100, height: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(22,163,74,0.06)", animation: "pulse 2s ease-in-out infinite" }} />
                <div style={{ position: "absolute", inset: 10, borderRadius: "50%", background: "rgba(22,163,74,0.10)", animation: "pulse 2s ease-in-out infinite 0.4s" }} />
                <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#16A34A", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 0 rgba(22,163,74,0.4)" }}>
                    <span style={{ fontSize: 28, color: "#fff" }}>🎤</span>
                </div>
            </div>
            <p style={{ color: "#15803D", fontWeight: 700, fontSize: 13 }}>Listening...</p>
            <WaveformAnim color="#16A34A" />
        </div>
    );
}

function FallingPersonIllustration() {
    return (
        <div style={{
            width: 120,
            height: 120,
            borderRadius: 16,
            background: "linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
        }}>
            <span style={{ fontSize: 64, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))" }}>🧑‍🦯</span>
        </div>
    );
}

// Simple icon components
function HeartMedIcon() {
    return <span style={{ fontSize: 28, color: "#DC2626" }}>❤️‍🔥</span>;
}

function AlarmIcon() {
    return <span style={{ fontSize: 28, color: "#DC2626" }}>🚨</span>;
}

function MicIconLarge() {
    return <span style={{ fontSize: 28, color: "#16A34A" }}>🎤</span>;
}

function SpeakerIcon({ active }) {
    return <span style={{ fontSize: 16, opacity: active ? 1 : 0.5 }}>🔊</span>;
}

function MicIcon({ active }) {
    return <span style={{ fontSize: 16, opacity: active ? 1 : 0.4 }}>🎤</span>;
}

function InfoIcon({ color = "#1D4ED8" }) {
    return (
        <div style={{ width: 18, height: 18, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ color: "#fff", fontSize: 11, fontWeight: 800 }}>i</span>
        </div>
    );
}

function PhoneIcon() {
    return <span style={{ fontSize: 26, color: "#fff" }}>📞</span>;
}

function PersonIcon() {
    return <span style={{ fontSize: 22, color: "#6B7280" }}>👤</span>;
}

function StopIcon() {
    return (
        <div style={{ width: 22, height: 22, borderRadius: 4, background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ color: "#fff", fontSize: 12, fontWeight: 900 }}>■</span>
        </div>
    );
}

// ================================================================
// STYLES
// ================================================================

const styles = {
    card: {
        position: "relative",
        background: "#FFFFFF",
        borderRadius: 24,
        boxShadow: "0 25px 60px rgba(0,0,0,0.30), 0 8px 20px rgba(0,0,0,0.15)",
        padding: "28px 28px 20px 28px",
        width: "100%",
        maxWidth: 680,
        maxHeight: "90vh",
        overflowY: "auto",
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    },

    badge: (_, bg, color) => ({
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 14px",
        borderRadius: 999,
        background: bg,
        color: color,
        marginBottom: 16,
    }),

    badgeDot: (color) => ({
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        display: "inline-block",
        animation: "blink 1.2s ease-in-out infinite",
    }),

    xButton: {
        position: "absolute",
        top: 16,
        right: 16,
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: "#F3F4F6",
        border: "2px solid #E5E7EB",
        color: "#374151",
        fontSize: 16,
        fontWeight: 700,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: 1,
        transition: "background 0.15s",
        zIndex: 10,
    },

    cardHeader: {
        display: "flex",
        alignItems: "flex-start",
        gap: 16,
        marginBottom: 20,
    },

    iconCircle: (bg) => ({
        width: 60,
        height: 60,
        borderRadius: "50%",
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    }),

    mainTitle: {
        fontSize: 22,
        fontWeight: 800,
        lineHeight: 1.2,
        color: "#111827",
        margin: 0,
    },

    bold14: {
        fontSize: 14,
        fontWeight: 700,
        color: "#111827",
        margin: 0,
    },

    subtext: {
        fontSize: 13,
        fontWeight: 500,
        color: "#374151",
        margin: "4px 0 0 0",
        lineHeight: 1.5,
    },

    bodyRow: {
        display: "flex",
        gap: 20,
        alignItems: "flex-start",
        marginBottom: 20,
        flexWrap: "wrap",
    },

    leftPanel: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },

    boldPrompt: {
        fontSize: 18,
        fontWeight: 800,
        color: "#111827",
        margin: "0 0 4px 0",
    },

    countdownCircle: {
        width: 80,
        height: 80,
        borderRadius: "50%",
        border: "4px solid #DC2626",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 12,
        background: "rgba(220,38,38,0.05)",
    },

    countdownNumber: {
        fontSize: 28,
        fontWeight: 900,
        color: "#DC2626",
        lineHeight: 1,
        fontFamily: "monospace",
    },

    countdownLabel: {
        fontSize: 10,
        fontWeight: 600,
        color: "#DC2626",
        marginTop: 2,
    },

    voiceRow: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginTop: 12,
        padding: "8px 12px",
        borderRadius: 10,
        background: "#F9FAFB",
        border: "1px solid #E5E7EB",
    },

    voiceItem: {
        display: "flex",
        alignItems: "center",
        gap: 6,
    },

    voiceDivider: {
        width: 1,
        height: 24,
        background: "#E5E7EB",
    },

    infoStrip: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginTop: 14,
        padding: "8px 14px",
        borderRadius: 10,
        background: "#EFF6FF",
        border: "1px solid #BFDBFE",
    },

    infoCard: {
        padding: "14px 16px",
        borderRadius: 14,
        background: "#F9FAFB",
        border: "1px solid #E5E7EB",
    },

    patientPhoto: {
        width: 44,
        height: 44,
        borderRadius: "50%",
        objectFit: "cover",
        border: "2px solid #E5E7EB",
    },

    patientPhotoPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: "#E5E7EB",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },

    sayChip: (color) => ({
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 16px",
        borderRadius: 10,
        background: color === "green" ? "#D1FAE5" : "#FEE2E2",
        color: color === "green" ? "#065F46" : "#991B1B",
        fontWeight: 700,
        fontSize: 15,
        border: `2px solid ${color === "green" ? "#A7F3D0" : "#FECACA"}`,
        cursor: "default",
    }),

    callPanel: {
        padding: "16px",
        borderRadius: 14,
        background: "#F0FDF4",
        border: "2px solid #A7F3D0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
    },

    callCircle: {
        width: 64,
        height: 64,
        borderRadius: "50%",
        background: "#16A34A",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 0 0 8px rgba(22,163,74,0.15), 0 0 0 16px rgba(22,163,74,0.07)",
        animation: "pulse 2s ease-in-out infinite",
    },

    infoBox: {
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 10,
        background: "#EFF6FF",
        border: "1px solid #BFDBFE",
        marginTop: 10,
    },

    safeButton: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        width: "100%",
        padding: "18px 20px",
        borderRadius: 16,
        background: "#DC2626",
        color: "#fff",
        border: "none",
        cursor: "pointer",
        marginTop: 20,
        transition: "background 0.2s",
        textAlign: "left",
    },

    heading: {
        fontSize: 22,
        fontWeight: 800,
        margin: "0 0 8px 0",
    },
};
