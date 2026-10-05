const MEDJARVIS_BLE_SERVICE_UUID =
    "7d2f1000-7c3b-4f2e-9d2c-5a1e8b7c1000";

const BLE_DEVICE_INFO_UUID =
    "7d2f1001-7c3b-4f2e-9d2c-5a1e8b7c1000";

const BLE_AUTH_UUID =
    "7d2f1002-7c3b-4f2e-9d2c-5a1e8b7c1000";

const BLE_CONTROL_UUID =
    "7d2f1003-7c3b-4f2e-9d2c-5a1e8b7c1000";

const BLE_VITALS_UUID =
    "7d2f1004-7c3b-4f2e-9d2c-5a1e8b7c1000";

const BLE_STATUS_UUID =
    "7d2f1005-7c3b-4f2e-9d2c-5a1e8b7c1000";

const BLE_PPG_UUID =
    "7d2f1006-7c3b-4f2e-9d2c-5a1e8b7c1000";

const BLE_EMERGENCY_UUID =
    "7d2f1007-7c3b-4f2e-9d2c-5a1e8b7c1000";

const MEDJARVIS_BLE_AUTH_TOKEN = "MJV-BLE-001";

let selectedDevice = null;
let connectedDevice = null;
let characteristics = null;
let activeCallbacks = {};
let disconnectHandler = null;

const textFrameBuffers = {
    S: new Map(),
    V: new Map(),
    E: new Map(),
};

const decoder = new TextDecoder();
const encoder = new TextEncoder();

function assertWebBluetoothAvailable() {
    if (
        typeof navigator === "undefined" ||
        !navigator.bluetooth
    ) {
        throw new Error(
            "Web Bluetooth is not available in this browser. Use Chrome/Chromium on a supported desktop or Android device."
        );
    }
}

function dataViewToUint8Array(dataView) {
    return new Uint8Array(
        dataView.buffer,
        dataView.byteOffset,
        dataView.byteLength
    );
}

function decodeUtf8(dataView) {
    return decoder.decode(dataView);
}

function clearFrameBuffers() {
    Object.values(textFrameBuffers).forEach((map) =>
        map.clear()
    );
}

async function getCharacteristicOrThrow(
    service,
    uuid,
    name
) {
    try {
        return await service.getCharacteristic(uuid);
    } catch (error) {
        const message =
            error?.message ||
            String(error);

        throw new Error(
            `MedJarvis BLE characteristic not found: ${name} (${uuid}). ` +
            `Make sure the ESP32 is running the current BLE firmware. ` +
            `Browser error: ${message}`
        );
    }
}

function parseFramedText(characteristicType, dataView) {
    const text = decodeUtf8(dataView);

    /*
     * ESP32 framing:
     *
     * byte 0     = characteristic type
     * bytes 1-3  = chunk index
     * bytes 4-6  = total chunks
     * byte 7     = |
     * bytes 8..  = JSON payload
     *
     * Example:
     * V000005|{"bandId":"BAND-MJ-001"...}
     */

    if (
        text.length < 8 ||
        text[0] !== characteristicType ||
        text[7] !== "|"
    ) {
        try {
            return JSON.parse(text);
        } catch {
            return null;
        }
    }

    const index = Number(
        text.slice(1, 4)
    );

    const total = Number(
        text.slice(4, 7)
    );

    const payload = text.slice(8);

    if (
        !Number.isInteger(index) ||
        !Number.isInteger(total) ||
        total < 1 ||
        index < 0 ||
        index >= total
    ) {
        return null;
    }

    const map =
        textFrameBuffers[
        characteristicType
        ];

    /*
     * Each JSON payload is sent as a numbered sequence of chunks.
     *
     * If one BLE notification is dropped, the old buffer could remain
     * incomplete forever. A later payload with the same chunk count
     * could then collide with that stale buffer.
     *
     * Start a fresh buffer whenever chunk 0 arrives and discard buffers
     * that have been waiting for more than 5 seconds.
     */
    if (index === 0) {
        map.delete(total);
        map.set(total, {
            total,
            chunks: new Array(total),
            received: 0,
            startedAt: Date.now(),
        });
    } else if (!map.has(total)) {
        map.set(total, {
            total,
            chunks: new Array(total),
            received: 0,
            startedAt: Date.now(),
        });
    }

    const buffer =
        map.get(total);

    if (
        Date.now() - buffer.startedAt >
        5000
    ) {
        map.delete(total);
        return null;
    }

    if (
        buffer.chunks[index] ===
        undefined
    ) {
        buffer.chunks[index] =
            payload;

        buffer.received += 1;
    }

    if (
        buffer.received !==
        buffer.total
    ) {
        return null;
    }

    map.delete(total);

    const fullPayload =
        buffer.chunks.join("");

    try {
        return JSON.parse(
            fullPayload
        );
    } catch (error) {
        console.error(
            "MedJarvis BLE JSON parse error:",
            error,
            fullPayload
        );

        return null;
    }
}

function decodePPGPacket(dataView) {
    const bytes =
        dataViewToUint8Array(
            dataView
        );

    /*
     * ESP32 PPG packet:
     *
     * byte 0     = 'P'
     * byte 1     = protocol version
     * bytes 2-5  = first sample sequence
     * byte 6     = sample count
     * byte 7     = beat bit-mask
     * bytes 8..  = uint32 LE IR samples
     */

    if (
        bytes.length < 8 ||
        bytes[0] !== 0x50 ||
        bytes[1] !== 0x01
    ) {
        return null;
    }

    const view =
        new DataView(
            bytes.buffer,
            bytes.byteOffset,
            bytes.byteLength
        );

    const startSequence =
        view.getUint32(
            2,
            true
        );

    const sampleCount =
        bytes[6];

    const beatMask =
        bytes[7];

    if (
        sampleCount < 1 ||
        sampleCount > 2 ||
        bytes.length <
        8 +
        sampleCount *
        4
    ) {
        return null;
    }

    const samples = [];
    const beatPositions = [];

    for (
        let index = 0;
        index < sampleCount;
        index += 1
    ) {
        samples.push(
            view.getUint32(
                8 +
                index * 4,
                true
            )
        );

        if (
            beatMask &
            (1 << index)
        ) {
            beatPositions.push(
                index
            );
        }
    }

    return {
        type: "ppg",
        startSequence,
        sampleCount,
        samples,
        beatPositions,
    };
}

function handleStatusNotification(
    event
) {
    const data =
        parseFramedText(
            "S",
            event.target.value
        );

    if (!data) return;

    if (
        data.type === "auth" &&
        data.authorized === true
    ) {
        activeCallbacks.onAuthorized?.(
            data
        );
    }

    activeCallbacks.onStatus?.(
        data
    );
}

function handleVitalsNotification(
    event
) {
    const data =
        parseFramedText(
            "V",
            event.target.value
        );

    if (!data) return;

    activeCallbacks.onVitals?.(
        data
    );
}

function handleEmergencyNotification(
    event
) {
    const data =
        parseFramedText(
            "E",
            event.target.value
        );

    if (!data) return;

    activeCallbacks.onEmergency?.(
        data
    );
}

function handlePPGNotification(
    event
) {
    const data =
        decodePPGPacket(
            event.target.value
        );

    if (!data) return;

    activeCallbacks.onPPG?.(
        data
    );
}

function removeNotificationListeners() {
    if (!characteristics) {
        return;
    }

    const {
        status,
        vitals,
        ppg,
        emergency,
    } = characteristics;

    status?.removeEventListener(
        "characteristicvaluechanged",
        handleStatusNotification
    );

    vitals?.removeEventListener(
        "characteristicvaluechanged",
        handleVitalsNotification
    );

    ppg?.removeEventListener(
        "characteristicvaluechanged",
        handlePPGNotification
    );

    emergency?.removeEventListener(
        "characteristicvaluechanged",
        handleEmergencyNotification
    );
}

function resetConnectionState() {
    removeNotificationListeners();

    characteristics = null;
    connectedDevice = null;
    selectedDevice = null;

    clearFrameBuffers();
}

export function isWebBluetoothSupported() {
    return (
        typeof navigator !==
        "undefined" &&
        !!navigator.bluetooth
    );
}

export async function scanForMedJarvisBand() {
    assertWebBluetoothAvailable();

    /*
     * Important:
     *
     * requestDevice() opens the browser's BLE chooser.
     * Selecting the device here does NOT establish the
     * GATT connection yet.
     *
     * The actual GATT connection happens only after the
     * user presses "Connect Band" in MyHealthPage.
     */

    const device =
        await navigator.bluetooth.requestDevice(
            {
                filters: [
                    {
                        services: [
                            MEDJARVIS_BLE_SERVICE_UUID,
                        ],
                    },
                ],
                optionalServices: [
                    MEDJARVIS_BLE_SERVICE_UUID,
                ],
            }
        );

    selectedDevice =
        device;

    return device;
}

export async function connectMedJarvisBand(
    device = selectedDevice,
    callbacks = {}
) {
    assertWebBluetoothAvailable();

    if (!device) {
        throw new Error(
            "No MedJarvis Band has been selected."
        );
    }

    activeCallbacks =
        callbacks;

    if (
        connectedDevice &&
        connectedDevice !== device
    ) {
        await disconnectMedJarvisBand();
    }

    selectedDevice =
        device;

    const server =
        device.gatt?.connected
            ? device.gatt
            : await device.gatt.connect();

    const service =
        await server.getPrimaryService(
            MEDJARVIS_BLE_SERVICE_UUID
        );

    let deviceInfo;
    let auth;
    let control;
    let vitals;
    let status;
    let ppg;
    let emergency;

    /*
     * Discover each characteristic separately.
     *
     * This gives us a precise error if one characteristic
     * is missing from the GATT server instead of a generic
     * Promise.all() failure.
     */
    try {
        deviceInfo = await getCharacteristicOrThrow(
            service,
            BLE_DEVICE_INFO_UUID,
            "Device Info"
        );

        auth = await getCharacteristicOrThrow(
            service,
            BLE_AUTH_UUID,
            "Auth"
        );

        control = await getCharacteristicOrThrow(
            service,
            BLE_CONTROL_UUID,
            "Control"
        );

        vitals = await getCharacteristicOrThrow(
            service,
            BLE_VITALS_UUID,
            "Vitals"
        );

        status = await getCharacteristicOrThrow(
            service,
            BLE_STATUS_UUID,
            "Status"
        );

        ppg = await getCharacteristicOrThrow(
            service,
            BLE_PPG_UUID,
            "PPG"
        );

        emergency = await getCharacteristicOrThrow(
            service,
            BLE_EMERGENCY_UUID,
            "Emergency"
        );
    } catch (error) {
        try {
            if (device.gatt?.connected) {
                device.gatt.disconnect();
            }
        } catch (disconnectError) {
            console.warn(
                "BLE discovery disconnect warning:",
                disconnectError
            );
        }

        resetConnectionState();
        throw error;
    }

    characteristics = {
        deviceInfo,
        auth,
        control,
        vitals,
        status,
        ppg,
        emergency,
    };

    connectedDevice =
        device;

    disconnectHandler =
        () => {
            clearFrameBuffers();

            activeCallbacks
                .onDisconnected?.();
        };

    device.addEventListener(
        "gattserverdisconnected",
        disconnectHandler
    );

    status.addEventListener(
        "characteristicvaluechanged",
        handleStatusNotification
    );

    vitals.addEventListener(
        "characteristicvaluechanged",
        handleVitalsNotification
    );

    ppg.addEventListener(
        "characteristicvaluechanged",
        handlePPGNotification
    );

    emergency.addEventListener(
        "characteristicvaluechanged",
        handleEmergencyNotification
    );

    await Promise.all([
        status.startNotifications(),
        vitals.startNotifications(),
        ppg.startNotifications(),
        emergency.startNotifications(),
    ]);

    let bandId = "";

    try {
        const deviceInfoValue =
            await deviceInfo.readValue();

        bandId =
            decodeUtf8(
                deviceInfoValue
            ).trim();
    } catch (error) {
        console.warn(
            "Unable to read MedJarvis Band ID:",
            error
        );
    }

    if (!bandId) {
        bandId =
            device.name ||
            "Unknown MedJarvis Band";
    }

    activeCallbacks
        .onConnected?.({
            device,
            bandId,
        });

    /*
     * Application-level authorization.
     *
     * This prevents monitoring data/control from being
     * accepted by the ESP32 until the MedJarvis frontend
     * supplies the expected application token.
     *
     * This is NOT yet cryptographic BLE pairing/bonding.
     *
     * IMPORTANT:
     * The authorization listener is installed BEFORE
     * the token is written to avoid a race condition where
     * the ESP32 responds before the listener exists.
     */

    let authorizationResolve;
    let authorizationReject;
    let authorizationFinished = false;

    const previousOnAuthorized =
        activeCallbacks.onAuthorized;

    const authorizationPromise =
        new Promise((resolve, reject) => {
            authorizationResolve = resolve;
            authorizationReject = reject;

            const timeout =
                window.setTimeout(() => {
                    if (
                        authorizationFinished
                    ) {
                        return;
                    }

                    authorizationFinished =
                        true;

                    reject(
                        new Error(
                            "The MedJarvis Band did not confirm authorization. Keep the ESP32 powered on and try again."
                        )
                    );
                }, 5000);

            activeCallbacks.onAuthorized =
                (data) => {
                    previousOnAuthorized?.(
                        data
                    );

                    if (
                        authorizationFinished
                    ) {
                        return;
                    }

                    authorizationFinished =
                        true;

                    window.clearTimeout(
                        timeout
                    );

                    resolve(
                        data?.authorized ===
                        true
                    );
                };
        });

    try {
        /*
         * The listener is already active here.
         */
        await auth.writeValue(
            encoder.encode(
                MEDJARVIS_BLE_AUTH_TOKEN
            )
        );

        const authorized =
            await authorizationPromise;

        /*
         * Restore the callback supplied by MyHealthPage
         * after the authorization handshake completes.
         */
        activeCallbacks.onAuthorized =
            previousOnAuthorized;

        if (!authorized) {
            await disconnectMedJarvisBand();

            throw new Error(
                "MedJarvis Band authorization was rejected."
            );
        }

        return {
            device,
            bandId,
            authorized: true,
        };
    } catch (error) {
        authorizationFinished = true;

        authorizationReject?.(
            error
        );

        activeCallbacks.onAuthorized =
            previousOnAuthorized;

        await disconnectMedJarvisBand();

        throw error;
    }
}

export async function sendBandCommand(
    command
) {
    if (
        !characteristics?.control
    ) {
        throw new Error(
            "MedJarvis Band is not connected."
        );
    }

    if (!command) {
        throw new Error(
            "A MedJarvis Band command is required."
        );
    }

    await characteristics.control.writeValue(
        encoder.encode(
            String(command)
        )
    );
}

export async function disconnectMedJarvisBand() {
    const device =
        connectedDevice ||
        selectedDevice;

    if (!device) {
        resetConnectionState();
        return;
    }

    removeNotificationListeners();

    if (
        disconnectHandler &&
        device.removeEventListener
    ) {
        device.removeEventListener(
            "gattserverdisconnected",
            disconnectHandler
        );
    }

    try {
        if (
            device.gatt?.connected
        ) {
            device.gatt.disconnect();
        }
    } catch (error) {
        console.warn(
            "BLE disconnect warning:",
            error
        );
    } finally {
        resetConnectionState();
        activeCallbacks = {};
    }
}

export function getConnectedMedJarvisBand() {
    return connectedDevice;
}

export function getSelectedMedJarvisBand() {
    return selectedDevice;
}

export const MEDJARVIS_BLE = {
    SERVICE_UUID:
        MEDJARVIS_BLE_SERVICE_UUID,

    DEVICE_INFO_UUID:
        BLE_DEVICE_INFO_UUID,

    AUTH_UUID:
        BLE_AUTH_UUID,

    CONTROL_UUID:
        BLE_CONTROL_UUID,

    VITALS_UUID:
        BLE_VITALS_UUID,

    STATUS_UUID:
        BLE_STATUS_UUID,

    PPG_UUID:
        BLE_PPG_UUID,

    EMERGENCY_UUID:
        BLE_EMERGENCY_UUID,
};