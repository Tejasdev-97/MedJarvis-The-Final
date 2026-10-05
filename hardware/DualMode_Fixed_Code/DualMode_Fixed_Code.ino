/*
 * MedJarvis Dual-Mode ESP32 firmware
 * Fixed optical pipeline + BLE transport
 *
 * MAX30102  -> SpO2, heart rate, HRV, PPG
 * MPU6050   -> motion / prototype fall detection
 * DS18B20   -> probe temperature (NOT clinical body temperature)
 *
 * This is an academic prototype, not a certified medical device.
 * Values are estimates. Do not use for diagnosis or emergency care.
 *
 * Fixes vs DualMode_Final_Code:
 *  - Hardware averaging 4 @ 100 Hz => 25 Hz (Maxim SpO2 algorithm timing)
 *  - 100-sample SpO2 window = 4 seconds
 *  - Beat timing from sample index, not millis()/FIFO bursts
 *  - Single peak detector for HR and HRV (no dual-RR mix)
 *  - Adaptive LED current to keep IR DC in a usable band
 *  - Motion gate before accepting SpO2
 *  - Confidence not clamped to a fake 50% minimum
 *  - Optical task prefers FIFO drain if I2C mutex is busy
 *  - Continuous HR uses a bounded ~30-second RR evidence window
 *  - Safe mode transitions, gap-safe PPG/SpO2 handling, and emergency retry state
 *  - Wi-Fi/HTTP transport replaced by BLE GATT transport
 *  - Sensor processing and Spot/Continuous logic preserved
 *
 * Arduino: ESP32  |  SparkFun MAX3010x  |  Adafruit MPU6050  |  DallasTemperature
 */

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <string>
#include <Wire.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include "MAX30105.h"
#include "spo2_algorithm.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"

// ============================================================
// MEDJARVIS IDENTITY + BLE TRANSPORT
// ============================================================

const char* BAND_ID = "BAND-MJ-001";

// Prototype application-level BLE authorization token.
// This blocks MedJarvis data/control until the connected client
// completes the application handshake. Stronger BLE pairing/bonding
// can be added later without changing the sensor pipeline.
const char* MEDJARVIS_BLE_AUTH_TOKEN = "MJV-BLE-001";

const char* BLE_DEVICE_NAME = "MedJarvis-Band";

// Fixed MedJarvis GATT UUIDs. These must remain unchanged once
// the frontend BLE integration is implemented.
#define MEDJARVIS_BLE_SERVICE_UUID \
  "7d2f1000-7c3b-4f2e-9d2c-5a1e8b7c1000"

#define BLE_DEVICE_INFO_UUID \
  "7d2f1001-7c3b-4f2e-9d2c-5a1e8b7c1000"

#define BLE_AUTH_UUID \
  "7d2f1002-7c3b-4f2e-9d2c-5a1e8b7c1000"

#define BLE_CONTROL_UUID \
  "7d2f1003-7c3b-4f2e-9d2c-5a1e8b7c1000"

#define BLE_VITALS_UUID \
  "7d2f1004-7c3b-4f2e-9d2c-5a1e8b7c1000"

#define BLE_STATUS_UUID \
  "7d2f1005-7c3b-4f2e-9d2c-5a1e8b7c1000"

#define BLE_PPG_UUID \
  "7d2f1006-7c3b-4f2e-9d2c-5a1e8b7c1000"

#define BLE_EMERGENCY_UUID \
  "7d2f1007-7c3b-4f2e-9d2c-5a1e8b7c1000"

// Safe notification framing for the default BLE ATT payload.
// Each framed text notification is <= 20 bytes, so the frontend
// can work without relying on a larger negotiated MTU.
#define BLE_TEXT_CHUNK_SIZE 12

// PPG binary packet: header + up to 2 x uint32 samples <= 20 bytes.
#define BLE_PPG_PACKET_MAX_SAMPLES 2

// ============================================================
// PINS
// ============================================================

#define SDA_PIN      21
#define SCL_PIN      22
#define ONE_WIRE_PIN 4

// ============================================================
// MAX30102 — Maxim algorithm expects ~25 Hz
// ============================================================

const byte MAX_LED_BRIGHTNESS_START = 0x24;  // ~36/255; then adapted
const byte MAX_LED_MIN              = 0x10;
const byte MAX_LED_MAX              = 0x60;
const byte MAX_SAMPLE_AVERAGE       = 4;     // 100 / 4 = 25 Hz effective
const byte MAX_LED_MODE             = 2;     // Red + IR
const int  MAX_SAMPLE_RATE          = 100;
const int  MAX_PULSE_WIDTH          = 411;   // 18-bit
const int  MAX_ADC_RANGE            = 16384; // less saturation than 4096

const float EFFECTIVE_FS_HZ    = 25.0f;
const float SAMPLE_PERIOD_MS   = 1000.0f / EFFECTIVE_FS_HZ;  // 40 ms

const long  FINGER_IR_MIN      = 20000;
const long  FINGER_IR_MAX      = 220000;
const long  LED_TARGET_IR_LOW  = 50000;
const long  LED_TARGET_IR_HIGH = 150000;

#define SPO2_WINDOW_SIZE 100
#define SPO2_NEW_SAMPLES 25   // overlap 75; new window every 1 s at 25 Hz

// ============================================================
// MODES
// ============================================================

#define SPOT_MODE       1
#define CONTINUOUS_MODE 2

const unsigned long SPOT_DURATION                    = 60000UL;
const unsigned long CONTINUOUS_UPDATE_INTERVAL       = 1000UL;
const unsigned long CONTINUOUS_PHYSIO_UPDATE_INTERVAL = 15000UL;
const unsigned long CONTINUOUS_VALUE_FRESHNESS       = 20000UL;
const unsigned long CONTINUOUS_CONTROL_INTERVAL      = 500UL;
const unsigned long CONTINUOUS_PHYSIO_WARMUP         = 15000UL;
const unsigned long FINGER_STABLE_TIME               = 1500UL;
const unsigned long FINGER_LOSS_GRACE_TIME           = 1000UL;
const unsigned long CONTROL_CHECK_INTERVAL           = 500UL;
const unsigned long TEMPERATURE_INTERVAL             = 1000UL;
const unsigned long TEMPERATURE_CONVERSION_TIME_MS   = 200UL;  // DS18B20 max at 10-bit = ~187.5 ms
const uint8_t       TEMPERATURE_RESOLUTION           = 10;

#define RATE_SIZE 12
#define RR_BUFFER_SIZE 64
#define PHYSIO_VALIDATION_SIZE 40
#define MIN_VALID_HR_SAMPLES 8
#define MIN_VALID_SPO2_WINDOWS 3
#define MIN_HRV_BEATS 12

// Spot uses the same physiological evidence and validation floors as
// Continuous. Spot differs only in when the final snapshot is published.
// Legacy Spot-confidence thresholds retained because the existing Continuous
// low-evidence confidence fallback references them. They are no longer used
// to calculate the final Spot physiological values.
#define SPOT_MIN_HR_RR_ESTIMATE 4
#define SPOT_MIN_HR_CANDIDATES 3
#define SPOT_AGGREGATION_SIZE 256
#define PPG_WAVEFORM_SIZE 256
#define PPG_BEAT_HISTORY_SIZE 16
#define CONTINUOUS_HR_WINDOW_SIZE 96    // enough for 30 s near 180 BPM, with margin
const float CONTINUOUS_HR_WINDOW_MS = 30000.0f;

const uint32_t BEAT_REFRACTORY_SAMPLES = 8;   // 8 * 40 ms = 320 ms (~187 bpm max)
const uint32_t RR_MIN_SAMPLES          = 9;   // 360 ms ~ 167 bpm
const uint32_t RR_MAX_SAMPLES          = 37;  // 1480 ms ~ 40 bpm
const float    PEAK_FRACTION           = 0.30f;
const float    MIN_PEAK_AC             = 40.0f;

const float GRAVITY_MS2          = 9.81f;
const float MOTION_REJECT_MS2    = 1.8f;   // | |a| - g | above this => moving
const float FALL_IMPACT_ACCEL    = 25.0f;
const float FALL_IMPACT_GYRO     = 5.0f;
const float FALL_POSTURE_DEG     = 35.0f;
const float FALL_STILL_ACCEL_MAX = 11.5f;
const float FALL_STILL_GYRO_MAX  = 0.8f;
const unsigned long FALL_CANDIDATE_WINDOW        = 2500UL;
const unsigned long FALL_STILLNESS_CONFIRM_TIME  = 1800UL;
const unsigned long FALL_EVENT_COOLDOWN          = 10000UL;

// ============================================================
// OBJECTS
// ============================================================

MAX30105 maxSensor;
Adafruit_MPU6050 mpu;
OneWire oneWire(ONE_WIRE_PIN);
DallasTemperature ds18b20(&oneWire);

// ============================================================
// BLE OBJECTS / STATE
// ============================================================

BLEServer* bleServer = nullptr;
BLEService* medJarvisBleService = nullptr;

BLECharacteristic* bleDeviceInfoCharacteristic = nullptr;
BLECharacteristic* bleAuthCharacteristic = nullptr;
BLECharacteristic* bleControlCharacteristic = nullptr;
BLECharacteristic* bleVitalsCharacteristic = nullptr;
BLECharacteristic* bleStatusCharacteristic = nullptr;
BLECharacteristic* blePPGCharacteristic = nullptr;
BLECharacteristic* bleEmergencyCharacteristic = nullptr;

volatile bool bleDeviceConnected = false;
volatile bool bleAuthorized = false;
volatile bool bleAuthPending = false;
volatile bool bleControlPending = false;
volatile bool bleDisconnectPending = false;

char blePendingAuth[48] = {0};
char blePendingCommand[32] = {0};

uint32_t bleLastPPGSequenceSent = 0;
unsigned long lastBLEPPGNotify = 0;

portMUX_TYPE bleCommandMux = portMUX_INITIALIZER_UNLOCKED;

class MedJarvisBLEServerCallbacks;
class MedJarvisBLEAuthCallbacks;
class MedJarvisBLEControlCallbacks;

bool maxSensorPresent = false;
bool mpuSensorPresent = false;
bool temperatureSensorPresent = false;

int CURRENT_MODE = SPOT_MODE;

SemaphoreHandle_t i2cMutex = nullptr;
TaskHandle_t max30102TaskHandle = nullptr;
TaskHandle_t motionTaskHandle = nullptr;
volatile bool continuousAcquisitionStopRequested = false;
volatile bool continuousAcquisitionTaskRunning = false;
volatile bool motionTaskStopRequested = false;
volatile bool motionTaskRunning = false;

// ============================================================
// STATE
// ============================================================

bool measurementRunning = false;
bool fingerDetected = false;
bool stableFingerDetected = false;
bool fingerLossDetected = false;
bool continuousMonitoring = false;
bool monitoringActive = false;
bool spotAwaitingFreshStart = false;
bool fallEventDetected = false;
bool fallOrientationChanged = false;
bool temperatureReadingValid = false;
bool temperatureConversionRunning = false;

unsigned long measurementStartTime = 0;
unsigned long measurementEndTime = 0;
unsigned long fingerStableStart = 0;
unsigned long fingerMissingStart = 0;
unsigned long lastControlCheck = 0;
unsigned long continuousSessionStart = 0;
unsigned long lastContinuousBackendUpdate = 0;
unsigned long lastContinuousPhysioUpdate = 0;
unsigned long lastContinuousControlCheck = 0;
unsigned long lastTemperatureRequest = 0;
unsigned long lastConfirmedFallTime = 0;
unsigned long fallCandidateTime = 0;
unsigned long fallImpactTime = 0;
unsigned long fallStillnessStart = 0;

uint32_t sampleIndex = 0;
uint32_t lastBeatSample = 0;

// Beat-detector diagnostics. These do not affect the waveform or calculations.
uint32_t detectedPeakCount = 0;
uint32_t acceptedBeatCount = 0;
uint32_t refractoryPeakCount = 0;
uint32_t shortRRPeakCount = 0;
uint32_t resyncPeakCount = 0;
byte ledAmplitude = MAX_LED_BRIGHTNESS_START;
unsigned long lastLedAdjustSample = 0;

uint32_t irBuffer[SPO2_WINDOW_SIZE];
uint32_t redBuffer[SPO2_WINDOW_SIZE];
byte spo2BufferIndex = 0;
bool spo2MotionHistory[SPO2_WINDOW_SIZE];
bool spo2MotionSampleBad = false;
bool ppgGapDetected = false;

unsigned long maxSampleCount = 0;
unsigned long totalValidSpO2Samples = 0;
unsigned long totalSpO2Windows = 0;
unsigned long validSpO2Windows = 0;

long currentIR = 0;
long currentRed = 0;

int finalSpO2 = 0;
volatile int latestValidatedSpO2 = 0;
volatile int latestValidatedHeartRate = 0;
volatile unsigned long latestSpO2Update = 0;
volatile unsigned long latestHeartRateUpdate = 0;
unsigned long lastValidSpO2WindowTime = 0;
unsigned long lastSpO2SnapshotSourceTime = 0;

byte rates[RATE_SIZE];
byte rateSpot = 0;
byte validRateCount = 0;
float currentBPM = 0.0f;
int averageBPM = 0;
int medianBPM = 0;

int hrValidationValues[PHYSIO_VALIDATION_SIZE];
int spo2ValidationValues[PHYSIO_VALIDATION_SIZE];
byte hrValidationCount = 0;
byte spo2ValidationCount = 0;

int16_t spotSpO2Values[SPOT_AGGREGATION_SIZE];
int16_t spotHRValues[SPOT_AGGREGATION_SIZE];
uint16_t spotRRValues[SPOT_AGGREGATION_SIZE];
uint16_t spotSpO2Count = 0;
uint16_t spotHRCount = 0;
uint16_t spotRRCount = 0;
int aggregationScratch[SPOT_AGGREGATION_SIZE];
float rrScratch[SPOT_AGGREGATION_SIZE];

float rrIntervals[RR_BUFFER_SIZE];
byte rrSpot = 0;
byte rrCount = 0;

// Separate bounded ~30-second RR window for Continuous HR.
// This is independent of the 64-beat HRV buffer.
float continuousHRRR[CONTINUOUS_HR_WINDOW_SIZE];
uint16_t continuousHRRRSpot = 0;
uint16_t continuousHRRRCount = 0;
float continuousHRWindowDurationMs = 0.0f;
float hrvSDNN = 0.0f;
float hrvRMSSD = 0.0f;
byte validRRForHRV = 0;

float dcIR = 0.0f;
float dcRed = 0.0f;
float acSmooth = 0.0f;
float acPrev = 0.0f;
float acPrev2 = 0.0f;
float acAmplitude = 0.0f;
bool beatDetectorReady = false;

float spotSpO2Confidence = 0.0f;
float spotHRConfidence = 0.0f;
float spotHRVConfidence = 0.0f;
float measurementConfidence = 0.0f;
float continuousSpO2Confidence = 0.0f;
float continuousHRConfidence = 0.0f;
float continuousHRVConfidence = 0.0f;
float continuousMeasurementConfidence = 0.0f;
int signalQuality = 0;

float accelX = 0, accelY = 0, accelZ = 0;
float gyroX = 0, gyroY = 0, gyroZ = 0;
float tiltAngle = 0;
float accelMagnitudeSum = 0, gyroMagnitudeSum = 0, tiltSum = 0;
unsigned long mpuSampleCount = 0;
float lastAccelMagnitude = GRAVITY_MS2;

float temperatureC = 0.0f;

byte fallState = 0;
float fallEventConfidence = 0.0f;
float fallPreImpactTilt = 0.0f;
float fallCandidatePeakAccel = 0.0f;
float fallCandidatePeakGyro = 0.0f;

portMUX_TYPE ppgMux = portMUX_INITIALIZER_UNLOCKED;
volatile uint32_t ppgWaveform[PPG_WAVEFORM_SIZE];
volatile byte ppgWaveformIndex = 0;
volatile uint16_t ppgWaveformCount = 0;
volatile uint32_t ppgSampleSequence = 0;
volatile uint32_t ppgBeatSequence[PPG_BEAT_HISTORY_SIZE];
volatile byte ppgBeatSequenceCount = 0;

String lastSensorStatus = "";

// ============================================================
// FORWARD DECLARATIONS
// ============================================================

void setupMedJarvisBLE();
void checkMonitoringCommand();
void processBLEDisconnect();
void sendBLEAuthResult(bool authorized, const char* message);
void stopContinuousAcquisitionTask();
void stopContinuousMotionTask();
void stopSensorMeasurement();
void activateSensorMeasurement();
void sendSensorStatus(const char* status, const char* message, int remainingSeconds);
bool notifyBLEText(char characteristicType, const String& payload, bool requireAuthorization);
void sendBLEStatusPayload(const String& json, bool requireAuthorization = true);
void serviceBLEPPG();
void resetBLEPPGStreamState();

void resetMeasurementData();
void resetContinuousProcessingState();
void serviceMAX30102();
void processMAXSample(uint32_t irValue, uint32_t redValue);
void processSpO2Window();
void recordContinuousHRInterval(float rrMs);
int calculateContinuousHeartRateSnapshot();
float calculateContinuousHeartRateConfidence();
void updateContinuousValidatedValues();
float calculateContinuousCandidateHeartRateConfidence();


// ============================================================
// MEDJARVIS BLE CALLBACKS
// ============================================================

class MedJarvisBLEServerCallbacks : public BLEServerCallbacks
{
  void onConnect(BLEServer* server) override
  {
    (void)server;

    bleDeviceConnected = true;
    bleAuthorized = false;
    bleAuthPending = false;
    bleControlPending = false;
    bleDisconnectPending = false;

    portENTER_CRITICAL(&bleCommandMux);
    blePendingAuth[0] = '\0';
    blePendingCommand[0] = '\0';
    portEXIT_CRITICAL(&bleCommandMux);

    if (bleAuthCharacteristic)
      bleAuthCharacteristic->setValue("UNAUTHORIZED");

    Serial.println("BLE client connected. Waiting for MedJarvis authorization.");
  }

  void onDisconnect(BLEServer* server) override
  {
    (void)server;

    bleDeviceConnected = false;
    bleAuthorized = false;
    bleAuthPending = false;
    bleControlPending = false;
    bleDisconnectPending = true;

    portENTER_CRITICAL(&bleCommandMux);
    blePendingAuth[0] = '\0';
    blePendingCommand[0] = '\0';
    portEXIT_CRITICAL(&bleCommandMux);

    Serial.println("BLE client disconnected. Monitoring will be stopped.");

    // Resume advertising so another authorized MedJarvis session can connect.
    BLEDevice::startAdvertising();
  }
};

class MedJarvisBLEAuthCallbacks : public BLECharacteristicCallbacks
{
  void onWrite(BLECharacteristic* characteristic) override
  {
    String value = characteristic->getValue();
    if (value.isEmpty()) return;

    portENTER_CRITICAL(&bleCommandMux);
    strncpy(blePendingAuth, value.c_str(), sizeof(blePendingAuth) - 1);
    blePendingAuth[sizeof(blePendingAuth) - 1] = '\0';
    bleAuthPending = true;
    portEXIT_CRITICAL(&bleCommandMux);
  }
};

class MedJarvisBLEControlCallbacks : public BLECharacteristicCallbacks
{
  void onWrite(BLECharacteristic* characteristic) override
  {
    if (!bleDeviceConnected || !bleAuthorized) return;

    String value = characteristic->getValue();
    if (value.isEmpty()) return;

    portENTER_CRITICAL(&bleCommandMux);
    strncpy(blePendingCommand, value.c_str(), sizeof(blePendingCommand) - 1);
    blePendingCommand[sizeof(blePendingCommand) - 1] = '\0';
    bleControlPending = true;
    portEXIT_CRITICAL(&bleCommandMux);
  }
};

// ============================================================
// BLE INITIALIZATION
// ============================================================

void setupMedJarvisBLE()
{
  BLEDevice::init(BLE_DEVICE_NAME);

  bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new MedJarvisBLEServerCallbacks());

medJarvisBleService =
    bleServer->createService(BLEUUID(String(MEDJARVIS_BLE_SERVICE_UUID)), 25);

  bleDeviceInfoCharacteristic =
    medJarvisBleService->createCharacteristic(
      BLE_DEVICE_INFO_UUID,
      BLECharacteristic::PROPERTY_READ
    );

  bleAuthCharacteristic =
    medJarvisBleService->createCharacteristic(
      BLE_AUTH_UUID,
      BLECharacteristic::PROPERTY_WRITE |
      BLECharacteristic::PROPERTY_READ
    );
  bleAuthCharacteristic->setCallbacks(new MedJarvisBLEAuthCallbacks());

  bleControlCharacteristic =
    medJarvisBleService->createCharacteristic(
      BLE_CONTROL_UUID,
      BLECharacteristic::PROPERTY_WRITE
    );
  bleControlCharacteristic->setCallbacks(new MedJarvisBLEControlCallbacks());

  bleVitalsCharacteristic =
    medJarvisBleService->createCharacteristic(
      BLE_VITALS_UUID,
      BLECharacteristic::PROPERTY_NOTIFY
    );
  bleVitalsCharacteristic->addDescriptor(new BLE2902());

  bleStatusCharacteristic =
    medJarvisBleService->createCharacteristic(
      BLE_STATUS_UUID,
      BLECharacteristic::PROPERTY_NOTIFY
    );
  bleStatusCharacteristic->addDescriptor(new BLE2902());

  blePPGCharacteristic =
    medJarvisBleService->createCharacteristic(
      BLE_PPG_UUID,
      BLECharacteristic::PROPERTY_NOTIFY
    );
  blePPGCharacteristic->addDescriptor(new BLE2902());

  bleEmergencyCharacteristic =
    medJarvisBleService->createCharacteristic(
      BLE_EMERGENCY_UUID,
      BLECharacteristic::PROPERTY_NOTIFY
    );
  bleEmergencyCharacteristic->addDescriptor(new BLE2902());

  bleDeviceInfoCharacteristic->setValue(BAND_ID);
  bleAuthCharacteristic->setValue("UNAUTHORIZED");

  medJarvisBleService->start();

  BLEAdvertising* advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(MEDJARVIS_BLE_SERVICE_UUID);
  advertising->setScanResponse(true);

  BLEDevice::startAdvertising();

  Serial.println("BLE initialized.");
  Serial.print("BLE device: ");
  Serial.println(BLE_DEVICE_NAME);
  Serial.print("Band ID: ");
  Serial.println(BAND_ID);
  Serial.println("BLE advertising — waiting for MedJarvis client.");
}

// ============================================================
// BLE TEXT NOTIFICATION FRAMING
//
// Frame format (ASCII, <= 20 bytes):
//   <type><chunkIndex:3><chunkTotal:3>|<payload>
// Example:
//   V000012|{...}
//
// The frontend reassembles chunks belonging to the same
// characteristic before parsing the JSON payload.
// ============================================================

bool notifyBLEText(char characteristicType, const String& payload, bool requireAuthorization)
{
  if (!bleDeviceConnected) return false;
  if (requireAuthorization && !bleAuthorized) return false;

  BLECharacteristic* characteristic = nullptr;

  switch (characteristicType)
  {
    case 'V': characteristic = bleVitalsCharacteristic; break;
    case 'S': characteristic = bleStatusCharacteristic; break;
    case 'E': characteristic = bleEmergencyCharacteristic; break;
    default: return false;
  }

  if (!characteristic) return false;

  const size_t totalLength = payload.length();
  uint16_t totalChunks =
    (uint16_t)((totalLength + BLE_TEXT_CHUNK_SIZE - 1) / BLE_TEXT_CHUNK_SIZE);

  if (totalChunks == 0) totalChunks = 1;
  if (totalChunks > 999)
  {
    Serial.println("BLE text payload too large; notification skipped.");
    return false;
  }

  for (uint16_t index = 0; index < totalChunks; index++)
  {
    if (!bleDeviceConnected) return false;

    size_t offset = (size_t)index * BLE_TEXT_CHUNK_SIZE;
    size_t remaining = totalLength > offset ? totalLength - offset : 0;
    size_t chunkLength = min((size_t)BLE_TEXT_CHUNK_SIZE, remaining);

    char frame[21];
    snprintf(
      frame,
      sizeof(frame),
      "%c%03u%03u|",
      characteristicType,
      (unsigned int)index,
      (unsigned int)totalChunks
    );

    if (chunkLength > 0)
      memcpy(frame + 8, payload.c_str() + offset, chunkLength);

    frame[8 + chunkLength] = '\0';

    characteristic->setValue((uint8_t*)frame, 8 + chunkLength);
    characteristic->notify();

    // Vitals payloads can be large (often ~200 BLE chunks).
    // Give the BLE stack enough time to transmit each notification
    // instead of bursting chunks faster than the browser/controller
    // can reliably receive them.
    delay(10);
  }

  return true;
}

void sendBLEStatusPayload(const String& json, bool requireAuthorization)
{
  notifyBLEText('S', json, requireAuthorization);
}

void sendBLEAuthResult(bool authorized, const char* message)
{
  if (bleAuthCharacteristic)
    bleAuthCharacteristic->setValue(authorized ? "AUTHORIZED" : "DENIED");

  String json = "{";
  json += "\"type\":\"auth\",";
  json += "\"bandId\":\"" + String(BAND_ID) + "\",";
  json += "\"authorized\":";
  json += authorized ? "true" : "false";
  json += ",\"message\":\"" + String(message) + "\"";
  json += "}";

  sendBLEStatusPayload(json, false);
}

// ============================================================
// BLE PPG STREAM
//
// Binary packet format:
//   byte 0     = 'P'
//   byte 1     = protocol version (1)
//   bytes 2-5  = first sample sequence, uint32 LE
//   byte 6     = sample count (1..2)
//   byte 7     = beat bit-mask
//   bytes 8..  = uint32 LE IR samples
//
// Maximum packet = 16 bytes, safely below the default 20-byte
// notification payload. The frontend maintains the rolling
// waveform from these samples.
// ============================================================

void resetBLEPPGStreamState()
{
  bleLastPPGSequenceSent = 0;
  lastBLEPPGNotify = 0;
}

void serviceBLEPPG()
{
  if (!bleDeviceConnected || !bleAuthorized || !blePPGCharacteristic)
    return;

  unsigned long now = millis();

  uint32_t currentSequence = 0;
  uint16_t currentCount = 0;
  uint32_t samples[BLE_PPG_PACKET_MAX_SAMPLES] = {0, 0};
  byte beatMask = 0;
  byte sendCount = 0;
  uint32_t startSequence = 0;

  portENTER_CRITICAL(&ppgMux);

  currentSequence = ppgSampleSequence;
  currentCount = ppgWaveformCount;

  if (currentSequence > 0 && currentCount > 0)
  {
    uint32_t oldestSequence =
      currentSequence - currentCount + 1;

    uint32_t nextSequence =
      (bleLastPPGSequenceSent == 0)
        ? oldestSequence
        : bleLastPPGSequenceSent + 1;

    if (nextSequence < oldestSequence)
      nextSequence = oldestSequence;

    if (nextSequence <= currentSequence)
    {
      uint32_t available =
        currentSequence - nextSequence + 1;

      if (available >= BLE_PPG_PACKET_MAX_SAMPLES ||
          now - lastBLEPPGNotify >= 100UL)
      {
        sendCount = (byte)min(
          (uint32_t)BLE_PPG_PACKET_MAX_SAMPLES,
          available
        );

        startSequence = nextSequence;

        for (byte i = 0; i < sendCount; i++)
        {
          uint32_t sequence = startSequence + i;
          uint32_t offset = sequence - oldestSequence;

          int index =
            ((int)ppgWaveformIndex -
             (int)currentCount +
             PPG_WAVEFORM_SIZE +
             (int)offset) % PPG_WAVEFORM_SIZE;

          samples[i] = ppgWaveform[index];

          for (byte b = 0; b < ppgBeatSequenceCount; b++)
          {
            if (ppgBeatSequence[b] == sequence)
            {
              beatMask |= (1U << i);
              break;
            }
          }
        }
      }
    }
  }

  portEXIT_CRITICAL(&ppgMux);

  if (sendCount == 0) return;

  uint8_t packet[16] = {0};
  packet[0] = 'P';
  packet[1] = 1;
  packet[2] = (uint8_t)(startSequence & 0xFF);
  packet[3] = (uint8_t)((startSequence >> 8) & 0xFF);
  packet[4] = (uint8_t)((startSequence >> 16) & 0xFF);
  packet[5] = (uint8_t)((startSequence >> 24) & 0xFF);
  packet[6] = sendCount;
  packet[7] = beatMask;

  for (byte i = 0; i < sendCount; i++)
  {
    uint32_t value = samples[i];
    packet[8 + i * 4]     = (uint8_t)(value & 0xFF);
    packet[9 + i * 4]     = (uint8_t)((value >> 8) & 0xFF);
    packet[10 + i * 4]    = (uint8_t)((value >> 16) & 0xFF);
    packet[11 + i * 4]    = (uint8_t)((value >> 24) & 0xFF);
  }

  blePPGCharacteristic->setValue(packet, 8 + sendCount * 4);
  blePPGCharacteristic->notify();

  bleLastPPGSequenceSent = startSequence + sendCount - 1;
  lastBLEPPGNotify = now;
}

void processBLEDisconnect()
{
  if (!bleDisconnectPending) return;

  bleDisconnectPending = false;

  if (monitoringActive || continuousMonitoring || measurementRunning)
  {
    Serial.println("BLE disconnected: stopping active monitoring.");

    continuousMonitoring = false;
    monitoringActive = false;
    measurementRunning = false;

    stopContinuousAcquisitionTask();
    stopContinuousMotionTask();
    stopSensorMeasurement();
  }

  resetBLEPPGStreamState();
}

bool tryLockI2C(TickType_t ticks)
{
  if (!i2cMutex) return true;
  return xSemaphoreTake(i2cMutex, ticks) == pdTRUE;
}

void unlockI2C()
{
  if (i2cMutex) xSemaphoreGive(i2cMutex);
}

// ============================================================
// SETUP / LOOP
// ============================================================

void setup()
{
  Serial.begin(115200);
  delay(300);

  i2cMutex = xSemaphoreCreateMutex();
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(400000);

  Serial.println();
  Serial.println("================================================");
  Serial.println("  MEDJARVIS DUAL-MODE (FIXED OPTICAL PIPELINE)");
  Serial.println("================================================");
  Serial.println("Prototype only. Not a medical device.");

  setupMedJarvisBLE();
  connectAndConfigureMax();

  if (mpu.begin())
  {
    mpuSensorPresent = true;
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    Serial.println("MPU6050 detected.");
  }
  else
  {
    Serial.println("ERROR: MPU6050 not detected.");
  }

  ds18b20.begin();
  ds18b20.setWaitForConversion(false);
  if (ds18b20.getDeviceCount() > 0)
  {
    temperatureSensorPresent = true;
    ds18b20.setResolution(TEMPERATURE_RESOLUTION);
    Serial.println("DS18B20 detected.");
  }
  else
  {
    Serial.println("DS18B20 not detected.");
  }

  resetMeasurementData();
  resetSensorStatusState();
  stopSensorMeasurement();

  Serial.print("Band ID: ");
  Serial.println(BAND_ID);
  Serial.println("IDLE — BLE advertising; waiting for authorized START command.");
}

void loop()
{
  processBLEDisconnect();

  if (!measurementRunning && !continuousMonitoring)
  {
    checkMonitoringCommand();
  }

  if (monitoringActive && CURRENT_MODE == CONTINUOUS_MODE && continuousMonitoring)
  {
    runContinuousMonitoring();
    return;
  }

  if (monitoringActive && CURRENT_MODE == SPOT_MODE && !continuousMonitoring)
  {
    waitForStableFinger();
    if (monitoringActive && CURRENT_MODE == SPOT_MODE)
    {
      runSpotMeasurement();
    }
    return;
  }

  delay(100);
}

void connectAndConfigureMax()
{
  if (!maxSensor.begin(Wire, I2C_SPEED_FAST))
  {
    maxSensorPresent = false;
    Serial.println("ERROR: MAX30102 not detected.");
    return;
  }

  maxSensorPresent = true;
  maxSensor.setup(
    MAX_LED_BRIGHTNESS_START,
    MAX_SAMPLE_AVERAGE,
    MAX_LED_MODE,
    MAX_SAMPLE_RATE,
    MAX_PULSE_WIDTH,
    MAX_ADC_RANGE
  );
  ledAmplitude = MAX_LED_BRIGHTNESS_START;
  maxSensor.setPulseAmplitudeRed(ledAmplitude);
  maxSensor.setPulseAmplitudeIR(ledAmplitude);
  maxSensor.setPulseAmplitudeGreen(0);
  maxSensor.clearFIFO();
  Serial.println("MAX30102 configured at 25 Hz effective (avg 4 @ 100 Hz).");
}

// ============================================================
// RESET
// ============================================================

void resetBeatDetector()
{
  dcIR = 0;
  dcRed = 0;
  acSmooth = 0;
  acPrev = 0;
  acPrev2 = 0;
  acAmplitude = 0;
  beatDetectorReady = false;
  lastBeatSample = 0;
  sampleIndex = 0;
  detectedPeakCount = 0;
  acceptedBeatCount = 0;
  refractoryPeakCount = 0;
  shortRRPeakCount = 0;
  resyncPeakCount = 0;
}

void resetMeasurementData()
{
  measurementRunning = false;
  fingerDetected = false;
  stableFingerDetected = false;
  fingerLossDetected = false;
  fingerMissingStart = 0;
  measurementStartTime = 0;
  measurementEndTime = 0;
  fingerStableStart = 0;

  maxSampleCount = 0;
  totalValidSpO2Samples = 0;
  totalSpO2Windows = 0;
  validSpO2Windows = 0;
  spo2BufferIndex = 0;
  currentIR = 0;
  currentRed = 0;
  finalSpO2 = 0;
  latestValidatedSpO2 = 0;
  latestValidatedHeartRate = 0;
  latestSpO2Update = 0;
  latestHeartRateUpdate = 0;

  rateSpot = 0;
  validRateCount = 0;
  currentBPM = 0;
  averageBPM = 0;
  medianBPM = 0;
  hrValidationCount = 0;
  spo2ValidationCount = 0;
  rrSpot = 0;
  rrCount = 0;
  continuousHRRRSpot = 0;
  continuousHRRRCount = 0;
  continuousHRWindowDurationMs = 0.0f;
  hrvSDNN = 0;
  hrvRMSSD = 0;
  validRRForHRV = 0;
  spotSpO2Count = 0;
  spotHRCount = 0;
  spotRRCount = 0;
  spotSpO2Confidence = 0;
  spotHRConfidence = 0;
  spotHRVConfidence = 0;
  measurementConfidence = 0;
  continuousSpO2Confidence = 0;
  continuousHRConfidence = 0;
  continuousHRVConfidence = 0;
  continuousMeasurementConfidence = 0;
  signalQuality = 0;

  memset(irBuffer, 0, sizeof(irBuffer));
  memset(redBuffer, 0, sizeof(redBuffer));
  memset(spo2MotionHistory, 0, sizeof(spo2MotionHistory));
  spo2MotionSampleBad = false;
  ppgGapDetected = false;
  memset(rates, 0, sizeof(rates));
  memset(rrIntervals, 0, sizeof(rrIntervals));
  memset(continuousHRRR, 0, sizeof(continuousHRRR));
  memset(hrValidationValues, 0, sizeof(hrValidationValues));
  memset(spo2ValidationValues, 0, sizeof(spo2ValidationValues));

  accelMagnitudeSum = 0;
  gyroMagnitudeSum = 0;
  tiltSum = 0;
  mpuSampleCount = 0;
  temperatureReadingValid = false;
  temperatureConversionRunning = false;
  lastTemperatureRequest = 0;

  fallEventDetected = false;
  fallEventConfidence = 0;
  fallState = 0;
  fallCandidateTime = 0;
  fallImpactTime = 0;
  fallStillnessStart = 0;
  fallOrientationChanged = false;

  resetBeatDetector();

  portENTER_CRITICAL(&ppgMux);
  ppgWaveformIndex = 0;
  ppgWaveformCount = 0;
  ppgSampleSequence = 0;
  ppgBeatSequenceCount = 0;
  for (int i = 0; i < PPG_WAVEFORM_SIZE; i++) ppgWaveform[i] = 0;
  for (int i = 0; i < PPG_BEAT_HISTORY_SIZE; i++) ppgBeatSequence[i] = 0;
  portEXIT_CRITICAL(&ppgMux);

  resetBLEPPGStreamState();
}

void resetContinuousProcessingState()
{
  int keepSpO2 = latestValidatedSpO2;
  int keepHR = latestValidatedHeartRate;
  resetMeasurementData();
  latestValidatedSpO2 = 0;
  latestValidatedHeartRate = 0;
  (void)keepSpO2;
  (void)keepHR;
}

// ============================================================
// PPG UI BUFFERS
// ============================================================

void appendPPGSample(uint32_t irValue)
{
  portENTER_CRITICAL(&ppgMux);
  ppgSampleSequence++;
  ppgWaveform[ppgWaveformIndex] = irValue;
  ppgWaveformIndex = (ppgWaveformIndex + 1) % PPG_WAVEFORM_SIZE;
  if (ppgWaveformCount < PPG_WAVEFORM_SIZE) ppgWaveformCount++;
  portEXIT_CRITICAL(&ppgMux);
}

void recordPPGBeatEvent()
{
  portENTER_CRITICAL(&ppgMux);
  if (ppgSampleSequence == 0)
  {
    portEXIT_CRITICAL(&ppgMux);
    return;
  }
  if (ppgBeatSequenceCount < PPG_BEAT_HISTORY_SIZE)
  {
    ppgBeatSequence[ppgBeatSequenceCount++] = ppgSampleSequence;
  }
  else
  {
    for (byte i = 1; i < PPG_BEAT_HISTORY_SIZE; i++)
      ppgBeatSequence[i - 1] = ppgBeatSequence[i];
    ppgBeatSequence[PPG_BEAT_HISTORY_SIZE - 1] = ppgSampleSequence;
  }
  portEXIT_CRITICAL(&ppgMux);
}

// ============================================================
// MAX30102 SERVICE
// ============================================================

void serviceMAX30102()
{
  if (!maxSensorPresent) return;

  maxSensor.check();
  while (maxSensor.available())
  {
    uint32_t irValue = maxSensor.getFIFOIR();
    uint32_t redValue = maxSensor.getFIFORed();
    maxSensor.nextSample();
    processMAXSample(irValue, redValue);
  }
}

void adjustLedIfNeeded()
{
  if (sampleIndex - lastLedAdjustSample < 50) return;  // ~2 s
  lastLedAdjustSample = sampleIndex;

  byte next = ledAmplitude;
  if (currentIR < LED_TARGET_IR_LOW && next < MAX_LED_MAX)
    next = (byte)min((int)MAX_LED_MAX, (int)next + 4);
  else if (currentIR > LED_TARGET_IR_HIGH && next > MAX_LED_MIN)
    next = (byte)max((int)MAX_LED_MIN, (int)next - 4);

  if (next != ledAmplitude)
  {
    ledAmplitude = next;
    maxSensor.setPulseAmplitudeRed(ledAmplitude);
    maxSensor.setPulseAmplitudeIR(ledAmplitude);
  }
}

void processMAXSample(uint32_t irValue, uint32_t redValue)
{
  currentIR = (long)irValue;
  currentRed = (long)redValue;
  sampleIndex++;
  maxSampleCount++;

  bool usable = (irValue >= (uint32_t)FINGER_IR_MIN && irValue < (uint32_t)FINGER_IR_MAX);

  if (!usable)
  {
    fingerDetected = false;
    if (measurementRunning)
    {
      // Discard the partially filled optical window once when the gap starts,
      // so pre-gap samples cannot be combined with post-gap samples.
      if (!ppgGapDetected)
      {
        spo2BufferIndex = 0;
        memset(irBuffer, 0, sizeof(irBuffer));
        memset(redBuffer, 0, sizeof(redBuffer));
        memset(spo2MotionHistory, 0, sizeof(spo2MotionHistory));
        spo2MotionSampleBad = false;
      }
      ppgGapDetected = true;

      if (fingerMissingStart == 0) fingerMissingStart = millis();
      else if (millis() - fingerMissingStart >= FINGER_LOSS_GRACE_TIME)
      {
        // Finger-loss recovery is a Continuous-only behavior. Spot keeps
        // its fixed 60-second acquisition window without prompting/restarting.
        if (CURRENT_MODE == CONTINUOUS_MODE)
        {
          fingerLossDetected = true;
          stableFingerDetected = false;
        }
      }
    }
    return;
  }

  fingerDetected = true;
  fingerMissingStart = 0;

  if (ppgGapDetected)
  {
    resetBeatReferenceAfterGap();
    ppgGapDetected = false;
  }

  totalValidSpO2Samples++;
  appendPPGSample(irValue);
  adjustLedIfNeeded();

  irBuffer[spo2BufferIndex] = irValue;
  redBuffer[spo2BufferIndex] = redValue;
  spo2MotionHistory[spo2BufferIndex] = spo2MotionSampleBad;
  spo2MotionSampleBad = false;
  spo2BufferIndex++;
  if (spo2BufferIndex >= SPO2_WINDOW_SIZE)
  {
    processSpO2Window();
  }

  processBeatFromSample(irValue);
}

// ============================================================
// SINGLE BEAT DETECTOR (sample-index timed)
// ============================================================

void resetBeatReferenceAfterGap()
{
  dcIR = 0;
  dcRed = 0;
  acSmooth = 0;
  acPrev = 0;
  acPrev2 = 0;
  acAmplitude = 0;
  beatDetectorReady = false;
  lastBeatSample = 0;
}

void processBeatFromSample(uint32_t irValue)
{
  const float dcAlpha = 0.02f;
  const float acAlpha = 0.25f;

  if (!beatDetectorReady)
  {
    dcIR = (float)irValue;
    beatDetectorReady = true;
    return;
  }

  dcIR = dcIR * (1.0f - dcAlpha) + (float)irValue * dcAlpha;
  float ac = (float)irValue - dcIR;
  acSmooth = acSmooth * (1.0f - acAlpha) + ac * acAlpha;
  acAmplitude = acAmplitude * 0.99f + fabsf(acSmooth) * 0.01f;

  float threshold = fmaxf(MIN_PEAK_AC, acAmplitude * PEAK_FRACTION);

  bool localPeak =
    acPrev > acPrev2 &&
    acPrev >= acSmooth &&
    acPrev > threshold;

  if (localPeak)
  {
    detectedPeakCount++;
    uint32_t peakSample = (sampleIndex > 1) ? (sampleIndex - 1) : sampleIndex;

    // --- PART 3 FIX: Improved beat-reference bookkeeping ---
    // If this is the very first peak, just establish the reference; no RR yet.
    if (lastBeatSample == 0)
    {
      lastBeatSample = peakSample;
    }
    else
    {
      uint32_t dSamples = peakSample - lastBeatSample;

      // Peak inside refractory window: ignore it entirely; do NOT move lastBeatSample.
      if (dSamples < BEAT_REFRACTORY_SAMPLES)
      {
        refractoryPeakCount++;
        // skip — intentionally no update to lastBeatSample
      }
      // Peak beyond the maximum physiological interval: resynchronise reference only.
      else if (dSamples > RR_MAX_SAMPLES)
      {
        resyncPeakCount++;
        lastBeatSample = peakSample;  // recover reference; no RR recorded
      }
      // Valid RR interval range: accept the beat.
      else if (dSamples >= RR_MIN_SAMPLES)
      {
        float rrMs = (float)dSamples * SAMPLE_PERIOD_MS;
        float bpm = 60000.0f / rrMs;
        if (bpm >= 40.0f && bpm <= 180.0f)
        {
          acceptedBeatCount++;
          currentBPM = bpm;
          recordPPGBeatEvent();

          rates[rateSpot] = (byte)roundf(bpm);
          rateSpot = (rateSpot + 1) % RATE_SIZE;
          if (validRateCount < RATE_SIZE) validRateCount++;

          recordHeartRateCandidate((int)roundf(bpm));

          rrIntervals[rrSpot] = rrMs;
          rrSpot = (rrSpot + 1) % RR_BUFFER_SIZE;
          if (rrCount < RR_BUFFER_SIZE) rrCount++;

          // Both modes feed the same bounded one-minute RR evidence used by
          // the Continuous physiological engine. Continuous behavior is
          // unchanged; Spot simply waits until 60 s before publishing it.
          recordContinuousHRInterval(rrMs);

          // Keep the Spot RR counter for diagnostics only.
          if (CURRENT_MODE == SPOT_MODE)
            recordSpotRR((uint16_t)rrMs);

          calculateHeartRateAverage();
          calculateMedianHeartRate();
          calculateHRV();

          // Continuous physiological values are published only at the
          // 15-second snapshot boundary in runContinuousMonitoring().

          // Only update lastBeatSample after a successfully accepted beat.
          lastBeatSample = peakSample;
        }
        // bpm out of range: treat like over-range; resync reference.
        else
        {
          lastBeatSample = peakSample;
        }
      }
      // dSamples < RR_MIN_SAMPLES but >= BEAT_REFRACTORY_SAMPLES:
      // biologically short (shouldn't happen with current thresholds), drop peak.
      if (dSamples >= BEAT_REFRACTORY_SAMPLES && dSamples < RR_MIN_SAMPLES)
        shortRRPeakCount++;
    }
  }

  acPrev2 = acPrev;
  acPrev = acSmooth;
}

void recordSpotRR(uint16_t rrMs)
{
  if (spotRRCount < SPOT_AGGREGATION_SIZE)
    spotRRValues[spotRRCount++] = rrMs;
}

void recordHeartRateCandidate(int bpm)
{
  if (bpm < 40 || bpm > 180) return;

  if (hrValidationCount < PHYSIO_VALIDATION_SIZE)
    hrValidationValues[hrValidationCount++] = bpm;
  else
  {
    for (byte i = 1; i < PHYSIO_VALIDATION_SIZE; i++)
      hrValidationValues[i - 1] = hrValidationValues[i];
    hrValidationValues[PHYSIO_VALIDATION_SIZE - 1] = bpm;
  }

  if (CURRENT_MODE == SPOT_MODE && spotHRCount < SPOT_AGGREGATION_SIZE)
    spotHRValues[spotHRCount++] = (int16_t)bpm;
}

void recordSpO2Candidate(int spo2)
{
  if (spo2 < 70 || spo2 > 100) return;

  if (spo2ValidationCount < PHYSIO_VALIDATION_SIZE)
    spo2ValidationValues[spo2ValidationCount++] = spo2;
  else
  {
    for (byte i = 1; i < PHYSIO_VALIDATION_SIZE; i++)
      spo2ValidationValues[i - 1] = spo2ValidationValues[i];
    spo2ValidationValues[PHYSIO_VALIDATION_SIZE - 1] = spo2;
  }

  if (CURRENT_MODE == SPOT_MODE && spotSpO2Count < SPOT_AGGREGATION_SIZE)
    spotSpO2Values[spotSpO2Count++] = (int16_t)spo2;
}

// ============================================================
// SPO2 WINDOW (4 seconds @ 25 Hz)
// ============================================================

bool motionTooHigh()
{
  return fabsf(lastAccelMagnitude - GRAVITY_MS2) > MOTION_REJECT_MS2;
}

void processSpO2Window()
{
  totalSpO2Windows++;

  int32_t windowSpO2 = 0;
  int8_t windowValidSpO2 = 0;
  int32_t windowHR = 0;
  int8_t windowValidHR = 0;

  maxim_heart_rate_and_oxygen_saturation(
    irBuffer,
    SPO2_WINDOW_SIZE,
    redBuffer,
    &windowSpO2,
    &windowValidSpO2,
    &windowHR,
    &windowValidHR
  );

  double mean = 0, minimum = irBuffer[0], maximum = irBuffer[0];
  for (int i = 0; i < SPO2_WINDOW_SIZE; i++)
  {
    double v = (double)irBuffer[i];
    mean += v;
    if (v < minimum) minimum = v;
    if (v > maximum) maximum = v;
  }
  mean /= SPO2_WINDOW_SIZE;

  double variance = 0;
  for (int i = 0; i < SPO2_WINDOW_SIZE; i++)
  {
    double d = (double)irBuffer[i] - mean;
    variance += d * d;
  }
  variance /= SPO2_WINDOW_SIZE;
  double sd = sqrt(variance);
  double cv = mean > 0 ? sd / mean : 1.0;
  double range = maximum - minimum;

  bool perfusionOk = range >= 150.0;
  bool windowMotionBad = false;
  for (int i = 0; i < SPO2_WINDOW_SIZE; i++)
  {
    if (spo2MotionHistory[i])
    {
      windowMotionBad = true;
      break;
    }
  }
  bool opticalOk =
    mean >= FINGER_IR_MIN &&
    mean < FINGER_IR_MAX &&
    perfusionOk &&
    cv < 0.12 &&
    !motionTooHigh() &&
    !windowMotionBad;

  if (windowValidSpO2 && windowSpO2 >= 85 && windowSpO2 <= 100 && opticalOk)
  {
    validSpO2Windows++;
    recordSpO2Candidate((int)windowSpO2);
    lastValidSpO2WindowTime = millis();
  }

  // HR from the same Maxim 4-second PPG window is independently useful.
  // Do not make a valid HR candidate depend on the SpO2 algorithm accepting
  // its own result. The shared optical/motion gate still prevents obviously
  // bad windows from being used. RR-derived HR remains primary.
  if (windowValidHR && windowHR >= 40 && windowHR <= 180 && opticalOk)
    recordHeartRateCandidate((int)windowHR);

  // Keep newest 75 samples; next 25 complete the following 4 s window.
  for (int i = 0; i < SPO2_WINDOW_SIZE - SPO2_NEW_SAMPLES; i++)
  {
    irBuffer[i] = irBuffer[i + SPO2_NEW_SAMPLES];
    redBuffer[i] = redBuffer[i + SPO2_NEW_SAMPLES];
    spo2MotionHistory[i] = spo2MotionHistory[i + SPO2_NEW_SAMPLES];
  }
  for (int i = SPO2_WINDOW_SIZE - SPO2_NEW_SAMPLES; i < SPO2_WINDOW_SIZE; i++)
  {
    irBuffer[i] = 0;
    redBuffer[i] = 0;
    spo2MotionHistory[i] = false;
  }
  spo2BufferIndex = SPO2_WINDOW_SIZE - SPO2_NEW_SAMPLES;
}

// ============================================================
// AGGREGATION / CONFIDENCE (no fake 50% floor)
// ============================================================

static int medianOfCopy(int* values, uint16_t n)
{
  for (uint16_t i = 0; i < n; i++)
    for (uint16_t j = i + 1; j < n; j++)
      if (values[j] < values[i])
      {
        int t = values[i];
        values[i] = values[j];
        values[j] = t;
      }
  return values[n / 2];
}

int getRobustSpotSpO2()
{
  // Spot uses the exact same validated SpO2 snapshot logic as Continuous.
  // Retained for compatibility with existing call sites.
  if (spo2ValidationCount < MIN_VALID_SPO2_WINDOWS)
  {
    spotSpO2Confidence = 0;
    return 0;
  }

  int values[PHYSIO_VALIDATION_SIZE];
  for (byte i = 0; i < spo2ValidationCount; i++)
    values[i] = spo2ValidationValues[i];

  int med = medianOfCopy(values, spo2ValidationCount);
  spotSpO2Confidence =
    constrain(100.0f * spo2ValidationCount / 12.0f, 0.0f, 100.0f);

  return constrain(med, 70, 100);
}

int getRobustSpotHeartRate()
{
  // Spot uses the exact same ~30-second RR snapshot as Continuous.
  // No separate Spot HR algorithm or Maxim-window fallback is used.
  int result = calculateContinuousHeartRateSnapshot();
  spotHRConfidence = (result >= 40 && result <= 180)
    ? calculateContinuousHeartRateConfidence()
    : 0.0f;
  return result;
}

int getValidatedSpotHeartRate()
{
  return getRobustSpotHeartRate();
}

void calculateFinalSpO2()
{
  finalSpO2 = getRobustSpotSpO2();
}

float calculateSpO2Confidence()
{
  if (spo2ValidationCount < MIN_VALID_SPO2_WINDOWS) return 0.0f;

  // Match the existing Continuous SpO2 confidence exactly.
  return constrain(
    100.0f * spo2ValidationCount / 12.0f,
    0.0f, 100.0f
  );
}

float calculateHeartRateConfidence()
{
  // If we have enough RR evidence, confidence should describe that same
  // evidence used to calculate the final Spot HR.
  if (CURRENT_MODE == SPOT_MODE && spotRRCount >= SPOT_MIN_HR_RR_ESTIMATE)
  {
    uint16_t n = min((uint16_t)SPOT_AGGREGATION_SIZE, spotRRCount);
    for (uint16_t i = 0; i < n; i++)
      rrScratch[i] = (float)spotRRValues[i];

    for (uint16_t i = 0; i < n; i++)
      for (uint16_t j = i + 1; j < n; j++)
        if (rrScratch[j] < rrScratch[i])
        {
          float t = rrScratch[i];
          rrScratch[i] = rrScratch[j];
          rrScratch[j] = t;
        }

    float medianRR = (n % 2 == 1)
      ? rrScratch[n / 2]
      : (rrScratch[n / 2 - 1] + rrScratch[n / 2]) / 2.0f;

    uint16_t inliers = 0;
    float totalRelativeDeviation = 0.0f;

    for (uint16_t i = 0; i < n; i++)
    {
      float rr = (float)spotRRValues[i];
      if (rr >= 333.0f && rr <= 1500.0f &&
          fabsf(rr - medianRR) <= medianRR * 0.20f)
      {
        inliers++;
        totalRelativeDeviation += fabsf(rr - medianRR) / medianRR;
      }
    }

    if (inliers >= SPOT_MIN_HR_RR_ESTIMATE && medianRR > 0.0f)
    {
      float agreement = 100.0f * (float)inliers / (float)n;
      float consistency = constrain(
        100.0f - (totalRelativeDeviation / (float)inliers) * 500.0f,
        0.0f, 100.0f);
      float support = constrain(100.0f * (float)inliers / 20.0f, 0.0f, 100.0f);

      return constrain(agreement * 0.5f + consistency * 0.3f + support * 0.2f,
                       0.0f, 100.0f);
    }
  }

  // Fallback confidence for candidate-based Spot HR.
  if (spotHRCount < SPOT_MIN_HR_CANDIDATES) return 0.0f;

  for (uint16_t i = 0; i < spotHRCount; i++)
    aggregationScratch[i] = spotHRValues[i];
  int median = medianOfCopy(aggregationScratch, spotHRCount);

  uint16_t inliers = 0;
  long totalDev = 0;
  for (uint16_t i = 0; i < spotHRCount; i++)
  {
    int d = abs((int)spotHRValues[i] - median);
    if (d <= 10)
    {
      inliers++;
      totalDev += d;
    }
  }

  if (inliers < SPOT_MIN_HR_CANDIDATES) return 0.0f;

  float agreement = 100.0f * (float)inliers / (float)spotHRCount;
  float consistency = inliers > 0
    ? constrain(100.0f - ((float)totalDev / (float)inliers) * 2.0f, 0.0f, 100.0f)
    : 0.0f;
  float support = constrain(100.0f * (float)spotHRCount / 20.0f, 0.0f, 100.0f);

  return constrain(agreement * 0.5f + consistency * 0.3f + support * 0.2f,
                   0.0f, 100.0f);
}
float calculateHRVConfidence()
{
  // Spot and Continuous use the exact same HRV evidence floor and
  // confidence calculation.
  if (validRRForHRV < MIN_HRV_BEATS) return 0.0f;

  return constrain(100.0f * validRRForHRV / 40.0f, 0.0f, 95.0f);
}

void calculateHeartRateAverage()
{
  if (validRateCount == 0)
  {
    averageBPM = 0;
    return;
  }
  int total = 0;
  for (byte i = 0; i < validRateCount; i++) total += rates[i];
  averageBPM = total / validRateCount;
}

void calculateMedianHeartRate()
{
  if (validRateCount == 0)
  {
    medianBPM = 0;
    return;
  }
  byte temp[RATE_SIZE];
  for (byte i = 0; i < validRateCount; i++) temp[i] = rates[i];
  for (byte i = 0; i < validRateCount; i++)
    for (byte j = i + 1; j < validRateCount; j++)
      if (temp[j] < temp[i])
      {
        byte s = temp[i];
        temp[i] = temp[j];
        temp[j] = s;
      }
  if (validRateCount % 2 == 1)
    medianBPM = temp[validRateCount / 2];
  else
    medianBPM = (temp[validRateCount / 2 - 1] + temp[validRateCount / 2]) / 2;
}

void calculateHRV()
{
  // HRV uses the same 64-beat RR buffer and filtering in both modes.
  // Spot therefore produces the same HRV that Continuous would calculate
  // from the same accepted RR evidence at the same point in time.
  uint16_t count = rrCount;

  if (count < 4)
  {
    hrvSDNN = 0;
    hrvRMSSD = 0;
    validRRForHRV = 0;
    spotHRVConfidence = 0;
    return;
  }

  uint16_t n = min((uint16_t)RR_BUFFER_SIZE, count);
  float chronologicalRR[RR_BUFFER_SIZE];

  byte oldest = (byte)((rrSpot + RR_BUFFER_SIZE - n) % RR_BUFFER_SIZE);
  for (uint16_t i = 0; i < n; i++)
  {
    chronologicalRR[i] = rrIntervals[(oldest + i) % RR_BUFFER_SIZE];
    rrScratch[i] = chronologicalRR[i];
  }

  for (uint16_t i = 0; i < n; i++)
    for (uint16_t j = i + 1; j < n; j++)
      if (rrScratch[j] < rrScratch[i])
      {
        float t = rrScratch[i];
        rrScratch[i] = rrScratch[j];
        rrScratch[j] = t;
      }

  float medianRR = (n % 2 == 1)
    ? rrScratch[n / 2]
    : (rrScratch[n / 2 - 1] + rrScratch[n / 2]) / 2.0f;

  float sum = 0;
  validRRForHRV = 0;
  float filtered[RR_BUFFER_SIZE];

  for (uint16_t i = 0; i < n; i++)
  {
    float rr = chronologicalRR[i];

    if (rr >= 333.0f &&
        rr <= 1500.0f &&
        fabsf(rr - medianRR) <= medianRR * 0.30f)
    {
      filtered[validRRForHRV++] = rr;
      sum += rr;
    }
  }

  if (validRRForHRV < MIN_HRV_BEATS)
  {
    hrvSDNN = 0;
    hrvRMSSD = 0;
    spotHRVConfidence = 0;
    return;
  }

  float mean = sum / validRRForHRV;

  float var = 0;
  for (byte i = 0; i < validRRForHRV; i++)
  {
    float d = filtered[i] - mean;
    var += d * d;
  }

  var /= (validRRForHRV > 1) ? (validRRForHRV - 1) : 1;
  hrvSDNN = sqrtf(var);

  float rmssdAcc = 0;
  int pairs = 0;
  for (byte i = 1; i < validRRForHRV; i++)
  {
    float d = filtered[i] - filtered[i - 1];
    rmssdAcc += d * d;
    pairs++;
  }

  hrvRMSSD = pairs > 0 ? sqrtf(rmssdAcc / pairs) : 0;

  spotHRVConfidence = calculateHRVConfidence();
}

void calculateSignalQuality()
{
  if (!fingerDetected || currentIR < FINGER_IR_MIN || currentIR >= FINGER_IR_MAX)
  {
    signalQuality = 0;
    return;
  }

  uint32_t qualitySamples[PPG_WAVEFORM_SIZE];
  uint16_t count = 0;
  portENTER_CRITICAL(&ppgMux);
  count = ppgWaveformCount;
  for (uint16_t i = 0; i < count; i++)
  {
    int index = ((int)ppgWaveformIndex - (int)count + PPG_WAVEFORM_SIZE + (int)i) % PPG_WAVEFORM_SIZE;
    qualitySamples[i] = ppgWaveform[index];
  }
  portEXIT_CRITICAL(&ppgMux);

  if (count < 20)
  {
    signalQuality = 20;
    return;
  }

  double mean = 0, minimum = qualitySamples[0], maximum = qualitySamples[0];
  for (uint16_t i = 0; i < count; i++)
  {
    double v = qualitySamples[i];
    mean += v;
    if (v < minimum) minimum = v;
    if (v > maximum) maximum = v;
  }
  mean /= count;

  double var = 0;
  for (uint16_t i = 0; i < count; i++)
  {
    double d = qualitySamples[i] - mean;
    var += d * d;
  }
  double cv = mean > 0 ? sqrt(var / count) / mean : 1;

  int stab = 90;
  if (cv >= 0.12) stab = 30;
  else if (cv >= 0.08) stab = 55;
  else if (cv >= 0.05) stab = 75;

  double pulsatility = mean > 0 ? (maximum - minimum) / mean : 0;
  int pulse = (int)constrain(pulsatility * 800.0, 0.0, 100.0);
  int motion = motionTooHigh() ? 0 : 100;

  signalQuality = constrain((stab * 4 + pulse * 4 + motion * 2) / 10, 0, 100);
}

void recordContinuousHRInterval(float rrMs)
{
  if (rrMs < 333.0f || rrMs > 1500.0f) return;

  portENTER_CRITICAL(&ppgMux);

  if (continuousHRRRCount < CONTINUOUS_HR_WINDOW_SIZE)
  {
    continuousHRRR[continuousHRRRSpot] = rrMs;
    continuousHRRRSpot =
      (continuousHRRRSpot + 1) % CONTINUOUS_HR_WINDOW_SIZE;
    continuousHRRRCount++;
    continuousHRWindowDurationMs += rrMs;
  }
  else
  {
    // Buffer full: replace the oldest value at the insertion position.
    continuousHRWindowDurationMs -= continuousHRRR[continuousHRRRSpot];
    continuousHRRR[continuousHRRRSpot] = rrMs;
    continuousHRRRSpot =
      (continuousHRRRSpot + 1) % CONTINUOUS_HR_WINDOW_SIZE;
    continuousHRWindowDurationMs += rrMs;
  }

  // Keep only the most recent ~30 seconds of accepted RR evidence.
  while (continuousHRRRCount > 1 &&
         continuousHRWindowDurationMs > CONTINUOUS_HR_WINDOW_MS)
  {
    uint16_t oldest =
      (continuousHRRRSpot + CONTINUOUS_HR_WINDOW_SIZE -
       continuousHRRRCount) % CONTINUOUS_HR_WINDOW_SIZE;

    continuousHRWindowDurationMs -= continuousHRRR[oldest];
    continuousHRRRCount--;
  }

  portEXIT_CRITICAL(&ppgMux);
}

int calculateContinuousHeartRateSnapshot()
{
  float window[CONTINUOUS_HR_WINDOW_SIZE];
  float sorted[CONTINUOUS_HR_WINDOW_SIZE];

  uint16_t n = 0;

  portENTER_CRITICAL(&ppgMux);

  n = continuousHRRRCount;
  uint16_t oldest =
    (continuousHRRRSpot + CONTINUOUS_HR_WINDOW_SIZE - n) %
    CONTINUOUS_HR_WINDOW_SIZE;

  for (uint16_t i = 0; i < n; i++)
  {
    window[i] = continuousHRRR[(oldest + i) % CONTINUOUS_HR_WINDOW_SIZE];
    sorted[i] = window[i];
  }

  portEXIT_CRITICAL(&ppgMux);

  if (n < MIN_VALID_HR_SAMPLES)
  {
    // The Maxim 4-second PPG window already provides a validated HR estimate.
    // Use its recent candidates as a temporary continuous fallback so the
    // first 15-second snapshot is not blocked by the separate RR detector.
    if (CURRENT_MODE == CONTINUOUS_MODE && hrValidationCount >= 3)
    {
      int temp[PHYSIO_VALIDATION_SIZE];
      byte m = hrValidationCount;
      for (byte i = 0; i < m; i++) temp[i] = hrValidationValues[i];
      int med = medianOfCopy(temp, m);
      return constrain(med, 40, 180);
    }
    return 0;
  }

  // Robust median RR.
  for (uint16_t i = 0; i < n; i++)
    for (uint16_t j = i + 1; j < n; j++)
      if (sorted[j] < sorted[i])
      {
        float t = sorted[i];
        sorted[i] = sorted[j];
        sorted[j] = t;
      }

  float medianRR = (n % 2 == 1)
    ? sorted[n / 2]
    : (sorted[n / 2 - 1] + sorted[n / 2]) / 2.0f;

  float sumRR = 0.0f;
  uint16_t valid = 0;

  for (uint16_t i = 0; i < n; i++)
  {
    float rr = window[i];

    if (rr >= 333.0f &&
        rr <= 1500.0f &&
        fabsf(rr - medianRR) <= medianRR * 0.20f)
    {
      sumRR += rr;
      valid++;
    }
  }

  if (valid < MIN_VALID_HR_SAMPLES || sumRR <= 0.0f)
    return 0;

  // Average rate over the actual accepted RR duration.
  float bpm = (60000.0f * (float)valid) / sumRR;
  return constrain((int)roundf(bpm), 40, 180);
}

float calculateContinuousCandidateHeartRateConfidence()
{
  if (hrValidationCount < 3) return 0.0f;

  int values[PHYSIO_VALIDATION_SIZE];
  byte n = hrValidationCount;
  for (byte i = 0; i < n; i++) values[i] = hrValidationValues[i];

  int median = medianOfCopy(values, n);
  uint16_t inliers = 0;
  long totalDev = 0;
  for (byte i = 0; i < n; i++)
  {
    int d = abs(hrValidationValues[i] - median);
    if (d <= 10)
    {
      inliers++;
      totalDev += d;
    }
  }

  if (inliers < 3) return 0.0f;
  float agreement = 100.0f * (float)inliers / (float)n;
  float consistency = constrain(100.0f -
    ((float)totalDev / (float)inliers) * 2.0f, 0.0f, 100.0f);
  float support = constrain(100.0f * (float)n / 12.0f, 0.0f, 100.0f);
  return constrain(agreement * 0.5f + consistency * 0.3f + support * 0.2f, 0.0f, 100.0f);
}

float calculateContinuousHeartRateConfidence()
{
  float window[CONTINUOUS_HR_WINDOW_SIZE];
  float sorted[CONTINUOUS_HR_WINDOW_SIZE];

  uint16_t n = 0;

  portENTER_CRITICAL(&ppgMux);

  n = continuousHRRRCount;
  uint16_t oldest =
    (continuousHRRRSpot + CONTINUOUS_HR_WINDOW_SIZE - n) %
    CONTINUOUS_HR_WINDOW_SIZE;

  for (uint16_t i = 0; i < n; i++)
  {
    window[i] = continuousHRRR[(oldest + i) % CONTINUOUS_HR_WINDOW_SIZE];
    sorted[i] = window[i];
  }

  portEXIT_CRITICAL(&ppgMux);

  if (n < MIN_VALID_HR_SAMPLES)
  {
    if (CURRENT_MODE == CONTINUOUS_MODE && hrValidationCount >= 3)
      return calculateContinuousCandidateHeartRateConfidence();
    return 0.0f;
  }

  for (uint16_t i = 0; i < n; i++)
    for (uint16_t j = i + 1; j < n; j++)
      if (sorted[j] < sorted[i])
      {
        float t = sorted[i];
        sorted[i] = sorted[j];
        sorted[j] = t;
      }

  float medianRR = (n % 2 == 1)
    ? sorted[n / 2]
    : (sorted[n / 2 - 1] + sorted[n / 2]) / 2.0f;

  uint16_t inliers = 0;
  float totalRelativeDeviation = 0.0f;

  for (uint16_t i = 0; i < n; i++)
  {
    float rr = window[i];

    if (rr >= 333.0f &&
        rr <= 1500.0f &&
        fabsf(rr - medianRR) <= medianRR * 0.20f)
    {
      inliers++;
      totalRelativeDeviation += fabsf(rr - medianRR) / medianRR;
    }
  }

  if (inliers < MIN_VALID_HR_SAMPLES) return 0.0f;

  float agreement = 100.0f * (float)inliers / (float)n;

  float averageRelativeDeviation =
    totalRelativeDeviation / (float)inliers;

  float consistency =
    constrain(100.0f - averageRelativeDeviation * 1000.0f,
              0.0f, 100.0f);

  // Support is based on the configured ~30-second RR evidence window.
  // About 40 beats is typical around 80 BPM over 30 seconds.
  float support =
    constrain(100.0f * (float)n / 40.0f, 0.0f, 100.0f);

  return constrain(
    agreement * 0.5f +
    consistency * 0.3f +
    support * 0.2f,
    0.0f, 100.0f
  );
}

void updateContinuousValidatedValues()
{
  if (millis() - continuousSessionStart < CONTINUOUS_PHYSIO_WARMUP) return;

  // SpO2 remains based on the existing bounded validation history.
  // This function is called only at the 15-second physiological snapshot,
  // so the published value changes at the intended cadence.
  if (spo2ValidationCount >= MIN_VALID_SPO2_WINDOWS)
  {
    int values[PHYSIO_VALIDATION_SIZE];
    for (byte i = 0; i < spo2ValidationCount; i++)
      values[i] = spo2ValidationValues[i];

    int med = medianOfCopy(values, spo2ValidationCount);
    latestValidatedSpO2 = constrain(med, 70, 100);
    if (lastValidSpO2WindowTime > lastSpO2SnapshotSourceTime)
    {
      latestSpO2Update = millis();
      lastSpO2SnapshotSourceTime = lastValidSpO2WindowTime;
    }
    continuousSpO2Confidence =
      constrain(100.0f * spo2ValidationCount / 12.0f, 0.0f, 100.0f);
  }
  else
  {
    continuousSpO2Confidence = 0;
  }

  // Continuous HR is calculated from a bounded rolling ~30-second RR window.
  // During the first 30 seconds the window naturally grows; after that,
  // oldest RR intervals are evicted so HR remains responsive to recent evidence.
  int hrSnapshot = calculateContinuousHeartRateSnapshot();

  if (hrSnapshot >= 40 && hrSnapshot <= 180)
  {
    latestValidatedHeartRate = hrSnapshot;
    latestHeartRateUpdate = millis();
    continuousHRConfidence = calculateContinuousHeartRateConfidence();
  }
  else
  {
    continuousHRConfidence = 0;
  }

  if (hrvSDNN > 0 && validRRForHRV >= MIN_HRV_BEATS)
    continuousHRVConfidence = calculateHRVConfidence();
  else
    continuousHRVConfidence = 0;

  float sum = 0;
  byte n = 0;

  if (continuousSpO2Confidence > 0)
  {
    sum += continuousSpO2Confidence;
    n++;
  }

  if (continuousHRConfidence > 0)
  {
    sum += continuousHRConfidence;
    n++;
  }

  if (continuousHRVConfidence > 0)
  {
    sum += continuousHRVConfidence;
    n++;
  }

  continuousMeasurementConfidence = n > 0 ? sum / n : 0;
}

void finishMeasurementCalculations()
{
  calculateHeartRateAverage();
  calculateMedianHeartRate();
  calculateHRV();
  calculateSignalQuality();

  if (CURRENT_MODE == SPOT_MODE)
  {
    // Reuse the existing Continuous physiological snapshot engine once,
    // at the end of the 60-second Spot session. The shared HR engine uses
    // its most recent ~30 seconds of accepted RR evidence. No intermediate snapshots
    // are published during Spot acquisition.
    updateContinuousValidatedValues();

    finalSpO2 = latestValidatedSpO2;
    spotSpO2Confidence = continuousSpO2Confidence;
    spotHRConfidence = continuousHRConfidence;
    spotHRVConfidence = continuousHRVConfidence;
    measurementConfidence = continuousMeasurementConfidence;
  }
  else
  {
    // Continuous path intentionally remains unchanged.
    measurementConfidence = continuousMeasurementConfidence;
  }

  if (mpuSampleCount > 0)
  {
    accelMagnitudeSum /= mpuSampleCount;
    gyroMagnitudeSum /= mpuSampleCount;
    tiltSum /= mpuSampleCount;
  }
}

// ============================================================
// SPOT / CONTINUOUS
// ============================================================

void runSpotMeasurement()
{
  resetMeasurementData();
  measurementRunning = true;
  stableFingerDetected = true;

  Serial.println("SPOT 60s acquisition (no HTTP during sampling).");

  sendSensorStatus("MEASURING", "Reading started. Keep your finger still.", 60);

  if (tryLockI2C(pdMS_TO_TICKS(100)))
  {
    maxSensor.clearFIFO();
    unlockI2C();
  }
  if (temperatureSensorPresent) startTemperatureConversion();

  measurementStartTime = millis();

  // Spot reuses the existing Continuous physiological engine, but does not
  // publish its intermediate 15-second snapshots.
  continuousSessionStart = measurementStartTime;

  unsigned long lastMPUTime = millis();
  unsigned long lastTemperatureTime = millis();

  while (millis() - measurementStartTime < SPOT_DURATION && monitoringActive)
  {
    unsigned long now = millis();

    if (tryLockI2C(pdMS_TO_TICKS(5)))
    {
      serviceMAX30102();
      unlockI2C();
    }

    if (now - lastMPUTime >= 50UL)
    {
      lastMPUTime = now;
      if (tryLockI2C(pdMS_TO_TICKS(5)))
      {
        readMPU();
        unlockI2C();
      }
    }

    serviceTemperature();
    serviceBLEPPG();

    if (now - lastControlCheck >= CONTROL_CHECK_INTERVAL)
    {
      checkMonitoringCommand();
      lastControlCheck = now;
    }

    if (!monitoringActive) break;

    if (now - lastTemperatureTime >= TEMPERATURE_INTERVAL && temperatureSensorPresent)
    {
      lastTemperatureTime = now;
      if (!temperatureConversionRunning) startTemperatureConversion();
    }

    // Spot intentionally does not use Continuous finger-loss recovery.
    // Sampling continues for the full 60-second window; any usable sensor
    // evidence collected before/after a brief finger loss remains available
    // to the common physiological engine.

    delay(1);
  }

  if (!monitoringActive)
  {
    measurementRunning = false;
    stopSensorMeasurement();
    return;
  }

  measurementRunning = false;
  measurementEndTime = millis();

  if (temperatureSensorPresent && temperatureConversionRunning)
  {
    unsigned long t0 = millis();
    while (temperatureConversionRunning && millis() - t0 < 250UL)
    {
      serviceTemperature();
      delay(1);
    }
  }

  // Do not poll for a mode change here. A mode switch is handled by the
  // next main-loop iteration after this fixed 60-second Spot result is
  // finalized, preventing the new mode from corrupting this snapshot.
  finishMeasurementCalculations();
  // PART 4 FIX: extended diagnostic output so RR/HRV pipeline can be verified.
  Serial.printf(
    "Spot done. SpO2=%d HR=%d HRV=%.1f RMSSD=%.1f RR=%u ValidHRV=%u HRVConf=%.1f SQ=%d Peaks=%lu Accepted=%lu Refrac=%lu ShortRR=%lu Resync=%lu\n",
    finalSpO2,
    getValidatedSpotHeartRate(),
    hrvSDNN,
    hrvRMSSD,
    spotRRCount,
    validRRForHRV,
    spotHRVConfidence,
    signalQuality,
    (unsigned long)detectedPeakCount,
    (unsigned long)acceptedBeatCount,
    (unsigned long)refractoryPeakCount,
    (unsigned long)shortRRPeakCount,
    (unsigned long)resyncPeakCount
  );

  sendSensorStatus("READING_COMPLETE", "60-second Spot reading complete.", 0);
  sendVitalsToBackend(true);
  stopSensorMeasurement();
  sendSensorStatus("SESSION_COMPLETE", "Spot monitoring complete.", 0);
  spotAwaitingFreshStart = true;
  notifyMonitoringComplete();
}

void continuousMAX30102Task(void* parameter)
{
  (void)parameter;
  continuousAcquisitionTaskRunning = true;

  while (!continuousAcquisitionStopRequested && continuousMonitoring && monitoringActive)
  {
    bool gotLock = false;
    for (int attempt = 0; attempt < 8 && !gotLock; attempt++)
    {
      gotLock = tryLockI2C(pdMS_TO_TICKS(5));
      if (!gotLock) vTaskDelay(1);
    }
    if (gotLock)
    {
      serviceMAX30102();
      unlockI2C();
    }
    vTaskDelay(1);
  }

  continuousAcquisitionTaskRunning = false;
  max30102TaskHandle = nullptr;
  vTaskDelete(nullptr);
}

void startContinuousAcquisitionTask()
{
  if (max30102TaskHandle) return;
  continuousAcquisitionStopRequested = false;
  if (xTaskCreate(continuousMAX30102Task, "MAX30102Live", 8192, nullptr, 4, &max30102TaskHandle) != pdPASS)
  {
    max30102TaskHandle = nullptr;
    continuousAcquisitionTaskRunning = false;
    Serial.println("ERROR: MAX30102 task failed.");
  }
}

void stopContinuousAcquisitionTask()
{
  continuousAcquisitionStopRequested = true;
  unsigned long t0 = millis();
  while (continuousAcquisitionTaskRunning && millis() - t0 < 1000UL) delay(5);
  if (!continuousAcquisitionTaskRunning) max30102TaskHandle = nullptr;
}

void continuousMotionTask(void* parameter)
{
  (void)parameter;
  motionTaskRunning = true;
  unsigned long lastMotionSample = 0;

  while (!motionTaskStopRequested && continuousMonitoring && monitoringActive)
  {
    unsigned long now = millis();
    if (now - lastMotionSample >= 20UL)
    {
      lastMotionSample = now;
      if (tryLockI2C(pdMS_TO_TICKS(8)))
      {
        if (mpuSensorPresent) readMPU();
        unlockI2C();
      }
    }
    vTaskDelay(pdMS_TO_TICKS(5));
  }

  motionTaskRunning = false;
  motionTaskHandle = nullptr;
  vTaskDelete(nullptr);
}

void startContinuousMotionTask()
{
  if (motionTaskHandle) return;
  motionTaskStopRequested = false;
  if (xTaskCreate(continuousMotionTask, "MPULive", 4096, nullptr, 2, &motionTaskHandle) != pdPASS)
  {
    motionTaskHandle = nullptr;
    motionTaskRunning = false;
    Serial.println("ERROR: MPU task failed.");
  }
}

void stopContinuousMotionTask()
{
  motionTaskStopRequested = true;
  unsigned long t0 = millis();
  while (motionTaskRunning && millis() - t0 < 1000UL) delay(5);
  if (!motionTaskRunning) motionTaskHandle = nullptr;
}

void runContinuousMonitoring()
{
  continuousMonitoring = true;
  monitoringActive = true;

  if (!maxSensorPresent)
  {
    sendSensorStatus("SENSOR_ERROR", "MAX30102 sensor is not available.", -1);
    continuousMonitoring = false;
    monitoringActive = false;
    goto continuous_cleanup;
  }

  waitForStableFinger();
  if (!continuousMonitoring || !monitoringActive) goto continuous_cleanup;

  resetMeasurementData();
  measurementRunning = true;
  stableFingerDetected = true;
  continuousSessionStart = millis();
  lastContinuousBackendUpdate = millis();
  lastContinuousPhysioUpdate = millis();
  lastContinuousControlCheck = millis();

  if (tryLockI2C(pdMS_TO_TICKS(100)))
  {
    maxSensor.clearFIFO();
    unlockI2C();
  }
  if (temperatureSensorPresent) startTemperatureConversion();

  sendSensorStatus("MEASURING", "Continuous live monitoring is active.", -1);
  startContinuousAcquisitionTask();
  startContinuousMotionTask();

  if (!max30102TaskHandle || !motionTaskHandle)
  {
    sendSensorStatus("SENSOR_ERROR", "Unable to start continuous sensor tasks.", -1);
    continuousMonitoring = false;
    monitoringActive = false;
    measurementRunning = false;
    goto continuous_cleanup;
  }

  while (continuousMonitoring && monitoringActive)
  {
    if (millis() - lastContinuousControlCheck >= CONTINUOUS_CONTROL_INTERVAL)
    {
      checkMonitoringCommand();
      lastContinuousControlCheck = millis();
    }
    if (!continuousMonitoring || !monitoringActive) break;

    // PART 1 FIX: service DS18B20 conversion every loop iteration so the
    // asynchronous conversion started before the loop (and after finger
    // recovery) is actually completed and temperatureC is updated.
    serviceTemperature();
    serviceBLEPPG();

    if (millis() - lastContinuousBackendUpdate >= CONTINUOUS_UPDATE_INTERVAL)
    {
      if (!fingerLossDetected)
      {
        calculateSignalQuality();
        bool physioDue =
          (millis() - continuousSessionStart >= CONTINUOUS_PHYSIO_WARMUP) &&
          (millis() - lastContinuousPhysioUpdate >= CONTINUOUS_PHYSIO_UPDATE_INTERVAL);

        if (physioDue)
        {
          // Freeze one physiological snapshot before sending it.
          // HR uses the current bounded rolling one-minute RR window.
          updateContinuousValidatedValues();
        }

        sendVitalsToBackend(physioDue);
        if (physioDue) lastContinuousPhysioUpdate = millis();

        if (fallEventDetected)
        {
          if (sendEmergencyEvent())
          {
            fallEventDetected = false;
            fallEventConfidence = 0;
            fallState = 3;
          }
        }
      }
      lastContinuousBackendUpdate = millis();
    }

    if (fingerLossDetected)
    {
      stopContinuousAcquisitionTask();
      measurementRunning = false;
      if (tryLockI2C(pdMS_TO_TICKS(100)))
      {
        maxSensor.clearFIFO();
        unlockI2C();
      }
      fingerDetected = false;
      stableFingerDetected = false;
      fingerLossDetected = false;
      fingerMissingStart = 0;
      sendSensorStatus("FINGER_REMOVED", "Place your finger back on the sensor.", -1);

      waitForStableFinger();
      if (!continuousMonitoring || !monitoringActive) break;

      resetContinuousProcessingState();
      measurementRunning = true;
      stableFingerDetected = true;
      if (tryLockI2C(pdMS_TO_TICKS(100)))
      {
        maxSensor.clearFIFO();
        unlockI2C();
      }
      if (temperatureSensorPresent) startTemperatureConversion();
      startContinuousAcquisitionTask();
      sendSensorStatus("MEASURING", "Finger restored. Monitoring resumed.", -1);
      if (!motionTaskHandle) startContinuousMotionTask();
    }

    delay(5);
  }

continuous_cleanup:
  stopContinuousAcquisitionTask();
  stopContinuousMotionTask();
  measurementRunning = false;
  continuousMonitoring = false;
  monitoringActive = false;
  stopSensorMeasurement();
  sendSensorStatus("SESSION_STOPPED", "Continuous monitoring stopped.", 0);
  notifyMonitoringComplete();
}

bool fingerSignalCurrentlyPresent()
{
  return currentIR >= FINGER_IR_MIN && currentIR < FINGER_IR_MAX;
}

void waitForStableFinger()
{
  sendSensorStatus("WAITING_FOR_FINGER", "Place your finger on the sensor and hold still.", -1);
  fingerStableStart = 0;
  stableFingerDetected = false;
  fingerLossDetected = false;
  fingerMissingStart = 0;

  while (monitoringActive && (CURRENT_MODE == SPOT_MODE || CURRENT_MODE == CONTINUOUS_MODE))
  {
    if (tryLockI2C(pdMS_TO_TICKS(20)))
    {
      serviceMAX30102();
      unlockI2C();
    }

    if (fingerSignalCurrentlyPresent())
    {
      fingerDetected = true;
      fingerMissingStart = 0;
      if (fingerStableStart == 0)
      {
        fingerStableStart = millis();
        sendSensorStatus("FINGER_DETECTED", "Finger detected. Keep still.", -1);
        sendSensorStatus("STABILIZING", "Wait while the signal stabilizes.", -1);
      }
      if (millis() - fingerStableStart >= FINGER_STABLE_TIME)
      {
        stableFingerDetected = true;
        sendSensorStatus("SIGNAL_STABLE", "Signal stable. Starting measurement.", -1);
        return;
      }
    }
    else
    {
      fingerDetected = false;
      fingerStableStart = 0;
      stableFingerDetected = false;
      sendSensorStatus("WAITING_FOR_FINGER", "Place your finger on the sensor and hold still.", -1);
    }

    if (millis() - lastControlCheck >= CONTROL_CHECK_INTERVAL)
    {
      checkMonitoringCommand();
      lastControlCheck = millis();
    }
    delay(5);
  }
}

// ============================================================
// MPU / FALL
// ============================================================

void readMPU()
{
  if (!mpuSensorPresent) return;

  sensors_event_t accel, gyro, temp;
  mpu.getEvent(&accel, &gyro, &temp);

  float ax = accel.acceleration.x;
  float ay = accel.acceleration.y;
  float az = accel.acceleration.z;
  float gx = gyro.gyro.x;
  float gy = gyro.gyro.y;
  float gz = gyro.gyro.z;

  float am = sqrtf(ax * ax + ay * ay + az * az);
  float gm = sqrtf(gx * gx + gy * gy + gz * gz);

  if (!isfinite(ax) || !isfinite(ay) || !isfinite(az) ||
      !isfinite(gx) || !isfinite(gy) || !isfinite(gz) ||
      am < 0.5f || am > 80.0f || gm > 12.0f)
    return;

  accelX = ax; accelY = ay; accelZ = az;
  gyroX = gx; gyroY = gy; gyroZ = gz;
  lastAccelMagnitude = am;

  tiltAngle = atan2f(ax, sqrtf(ay * ay + az * az)) * 180.0f / PI;
  accelMagnitudeSum += am;
  gyroMagnitudeSum += gm;
  tiltSum += tiltAngle;
  mpuSampleCount++;

  if (fabsf(am - GRAVITY_MS2) > MOTION_REJECT_MS2)
    spo2MotionSampleBad = true;

  if (CURRENT_MODE == CONTINUOUS_MODE && continuousMonitoring)
    updateContinuousFallDetection();
}

void updateContinuousFallDetection()
{
  float am = lastAccelMagnitude;
  float gm = sqrtf(gyroX * gyroX + gyroY * gyroY + gyroZ * gyroZ);

  if (fallState == 3)
  {
    if (lastConfirmedFallTime > 0 && millis() - lastConfirmedFallTime >= FALL_EVENT_COOLDOWN)
    {
      fallState = 0;
      fallCandidateTime = 0;
      fallStillnessStart = 0;
      fallOrientationChanged = false;
    }
    return;
  }

  bool impact = am >= FALL_IMPACT_ACCEL || gm >= FALL_IMPACT_GYRO;

  if (fallState == 0)
  {
    if (impact)
    {
      fallState = 1;
      fallCandidateTime = fallImpactTime = millis();
      fallStillnessStart = 0;
      fallPreImpactTilt = tiltAngle;
      fallCandidatePeakAccel = am;
      fallCandidatePeakGyro = gm;
      fallOrientationChanged = false;
    }
    return;
  }

  if (fallState == 1)
  {
    if (am > fallCandidatePeakAccel) fallCandidatePeakAccel = am;
    if (gm > fallCandidatePeakGyro) fallCandidatePeakGyro = gm;
    if (fabsf(tiltAngle - fallPreImpactTilt) >= FALL_POSTURE_DEG)
      fallOrientationChanged = true;

    if (millis() - fallCandidateTime > FALL_CANDIDATE_WINDOW)
    {
      fallState = 0;
      return;
    }

    bool still = am <= FALL_STILL_ACCEL_MAX && gm <= FALL_STILL_GYRO_MAX;
    if (still)
    {
      if (fallStillnessStart == 0) fallStillnessStart = millis();
      if (millis() - fallStillnessStart >= FALL_STILLNESS_CONFIRM_TIME &&
          (fallOrientationChanged || fallCandidatePeakAccel >= 28.0f || fallCandidatePeakGyro >= 5.5f))
        fallState = 2;
    }
    else
    {
      fallStillnessStart = 0;
    }
    return;
  }

  if (fallState == 2)
  {
    if (!(am <= FALL_STILL_ACCEL_MAX && gm <= FALL_STILL_GYRO_MAX))
    {
      fallState = 0;
      return;
    }
    fallEventConfidence = constrain(
      40.0f +
      (fallCandidatePeakAccel >= 28.0f ? 20.0f : 0.0f) +
      (fallCandidatePeakGyro >= 5.5f ? 15.0f : 0.0f) +
      (fallOrientationChanged ? 20.0f : 0.0f),
      0.0f, 95.0f
    );
    fallEventDetected = true;
    lastConfirmedFallTime = millis();
    fallState = 3;
    Serial.println("CONFIRMED FALL CANDIDATE (probe IMU, not clinical).");
  }
}

// ============================================================
// TEMPERATURE
// ============================================================

void startTemperatureConversion()
{
  if (!temperatureSensorPresent) return;
  ds18b20.requestTemperatures();
  lastTemperatureRequest = millis();
  temperatureConversionRunning = true;
}

void finishTemperatureConversion()
{
  if (!temperatureSensorPresent || !temperatureConversionRunning) return;
  float temp = ds18b20.getTempCByIndex(0);
  if (temp != DEVICE_DISCONNECTED_C && isfinite(temp) && temp > 15.0f && temp < 50.0f)
  {
    temperatureC = temp;
    temperatureReadingValid = true;
  }
  else
  {
    temperatureReadingValid = false;
  }
  temperatureConversionRunning = false;
}

void serviceTemperature()
{
  if (!temperatureSensorPresent) return;
  unsigned long now = millis();
  // PART 2 FIX: use TEMPERATURE_CONVERSION_TIME_MS (200 ms) instead of
  // hard-coded 100 ms to safely cover DS18B20 10-bit max conversion time.
  if (temperatureConversionRunning && now - lastTemperatureRequest >= TEMPERATURE_CONVERSION_TIME_MS)
    finishTemperatureConversion();
  if (!temperatureConversionRunning && now - lastTemperatureRequest >= TEMPERATURE_INTERVAL)
    startTemperatureConversion();
}

// ============================================================
// BLE TRANSPORT
// ============================================================

static void jsonNullOrInt(String& payload, int value, bool ok)
{
  if (ok) payload += String(value);
  else payload += "null";
}

static void jsonNullOrFloat(String& payload, float value, int digits, bool ok)
{
  if (ok) payload += String(value, digits);
  else payload += "null";
}

void sendVitalsToBackend(bool includePhysiologicalValues)
{
  if (!bleDeviceConnected || !bleAuthorized)
  {
    Serial.println("Vitals not sent: MedJarvis BLE session is not authorized.");
    return;
  }

  int payloadSpO2 =
    (CURRENT_MODE == CONTINUOUS_MODE)
      ? latestValidatedSpO2
      : finalSpO2;

  int payloadHR =
    (CURRENT_MODE == CONTINUOUS_MODE)
      ? latestValidatedHeartRate
      : getValidatedSpotHeartRate();

  bool sendPhysio =
    (CURRENT_MODE == SPOT_MODE) ||
    includePhysiologicalValues;

  bool spo2Ok =
    sendPhysio &&
    payloadSpO2 >= 70 &&
    payloadSpO2 <= 100;

  bool hrOk =
    sendPhysio &&
    payloadHR >= 40 &&
    payloadHR <= 180;

  uint16_t requiredHRVBeats = MIN_HRV_BEATS;

  bool hrvOk =
    sendPhysio &&
    hrvSDNN > 0.0f &&
    validRRForHRV >= requiredHRVBeats;

  if (CURRENT_MODE == CONTINUOUS_MODE &&
      includePhysiologicalValues)
  {
    if (latestSpO2Update == 0 ||
        millis() - latestSpO2Update > CONTINUOUS_VALUE_FRESHNESS)
      spo2Ok = false;

    if (latestHeartRateUpdate == 0 ||
        millis() - latestHeartRateUpdate > CONTINUOUS_VALUE_FRESHNESS)
      hrOk = false;
  }

  String payload = "{";

  payload += "\"bandId\":\"";
  payload += BAND_ID;
  payload += "\"";

  payload += ",\"spo2\":";
  jsonNullOrInt(payload, payloadSpO2, spo2Ok);

  payload += ",\"heartRate\":";
  jsonNullOrInt(payload, payloadHR, hrOk);

  payload += ",\"hrvSDNN\":";
  jsonNullOrFloat(payload, hrvSDNN, 1, hrvOk);

  payload += ",\"temperature\":";
  jsonNullOrFloat(
    payload,
    temperatureC,
    2,
    temperatureSensorPresent && temperatureReadingValid
  );

  payload += ",\"tilt\":";
  payload += String(
    CURRENT_MODE == CONTINUOUS_MODE ? tiltAngle : tiltSum,
    2
  );

  payload += ",\"signalQuality\":";
  payload += String(signalQuality);

  float am =
    (CURRENT_MODE == CONTINUOUS_MODE)
      ? sqrtf(accelX * accelX + accelY * accelY + accelZ * accelZ)
      : accelMagnitudeSum;

  float gm =
    (CURRENT_MODE == CONTINUOUS_MODE)
      ? sqrtf(gyroX * gyroX + gyroY * gyroY + gyroZ * gyroZ)
      : gyroMagnitudeSum;

  payload += ",\"accelMagnitude\":";
  payload += String(am, 2);

  payload += ",\"gyroMagnitude\":";
  payload += String(gm, 2);

  payload += ",\"accelX\":";
  payload += String(accelX, 2);

  payload += ",\"accelY\":";
  payload += String(accelY, 2);

  payload += ",\"accelZ\":";
  payload += String(accelZ, 2);

  payload += ",\"gyroX\":";
  payload += String(gyroX, 2);

  payload += ",\"gyroY\":";
  payload += String(gyroY, 2);

  payload += ",\"gyroZ\":";
  payload += String(gyroZ, 2);

  payload += ",\"measurementDuration\":";

  if (CURRENT_MODE == SPOT_MODE)
  {
    payload += "60";
  }
  else
  {
    unsigned long sec =
      continuousSessionStart
        ? (millis() - continuousSessionStart) / 1000UL
        : 1UL;

    if (sec < 1) sec = 1;
    payload += String(sec);
  }

  payload += ",\"mode\":\"";
  payload +=
    (CURRENT_MODE == SPOT_MODE)
      ? "spot"
      : "continuous";
  payload += "\"";

  payload += ",\"maxSamples\":";
  payload += String(maxSampleCount);

  payload += ",\"spo2WindowSamples\":";
  payload += String(totalValidSpO2Samples);

  payload += ",\"mpuSamples\":";
  payload += String(mpuSampleCount);

  payload += ",\"validatedBeats\":";
  payload += String(validRateCount);

  payload += ",\"validatedRRIntervals\":";
  payload += String(rrCount);

  payload += ",\"validSpO2Windows\":";
  payload += String(validSpO2Windows);

  payload += ",\"fallDetected\":";
  payload +=
    (CURRENT_MODE == CONTINUOUS_MODE && fallEventDetected)
      ? "true"
      : "false";

  // Retained as a backward-compatible field name for the current
  // backend contract. The actual wearable transport is now BLE.
  payload += ",\"wifiConnected\":false";

  payload += ",\"transport\":\"BLE\"";

  payload += ",\"bleConnected\":";
  payload += bleDeviceConnected ? "true" : "false";

  payload += ",\"bleAuthorized\":";
  payload += bleAuthorized ? "true" : "false";

  payload += ",\"measurementConfidence\":";
  payload += String(
    CURRENT_MODE == CONTINUOUS_MODE
      ? continuousMeasurementConfidence
      : measurementConfidence,
    1
  );

  payload += ",\"spo2Confidence\":";
  payload += String(
    CURRENT_MODE == CONTINUOUS_MODE
      ? continuousSpO2Confidence
      : spotSpO2Confidence,
    1
  );

  payload += ",\"heartRateConfidence\":";
  payload += String(
    CURRENT_MODE == CONTINUOUS_MODE
      ? continuousHRConfidence
      : spotHRConfidence,
    1
  );

  payload += ",\"hrvConfidence\":";
  payload += String(
    CURRENT_MODE == CONTINUOUS_MODE
      ? continuousHRVConfidence
      : spotHRVConfidence,
    1
  );

  payload += ",\"fallEventConfidence\":";
  payload += String(fallEventConfidence, 1);

  // Raw PPG is streamed separately over BLE_PPG_UUID.
  // A full 256-sample waveform is included only for Spot final
  // results and Continuous physiological snapshots, preserving the
  // existing backend payload shape without flooding BLE every second.
  bool includePPGSnapshot =
    (CURRENT_MODE == SPOT_MODE) ||
    includePhysiologicalValues;

  payload += ",\"ppgWaveform\":[";

  uint16_t snapshotCount = 0;
  uint32_t ppgSnapshot[PPG_WAVEFORM_SIZE];

  portENTER_CRITICAL(&ppgMux);

  snapshotCount = ppgWaveformCount;

  if (includePPGSnapshot)
  {
    for (uint16_t i = 0; i < snapshotCount; i++)
    {
      int index =
        ((int)ppgWaveformIndex -
         (int)snapshotCount +
         PPG_WAVEFORM_SIZE +
         (int)i) %
        PPG_WAVEFORM_SIZE;

      ppgSnapshot[i] = ppgWaveform[index];
    }
  }

  portEXIT_CRITICAL(&ppgMux);

  if (includePPGSnapshot)
  {
    for (uint16_t i = 0; i < snapshotCount; i++)
    {
      if (i) payload += ",";
      payload += String(
        (unsigned long)ppgSnapshot[i]
      );
    }
  }

  payload += "]";

  payload += ",\"ppgBeatPositions\":[";

  uint16_t beatPositions[PPG_BEAT_HISTORY_SIZE];
  byte beatPositionCount = 0;

  if (includePPGSnapshot)
  {
    portENTER_CRITICAL(&ppgMux);

    if (snapshotCount > 0 &&
        ppgSampleSequence >= snapshotCount)
    {
      uint32_t startSeq =
        ppgSampleSequence -
        snapshotCount +
        1;

      for (byte i = 0;
           i < ppgBeatSequenceCount;
           i++)
      {
        uint32_t b = ppgBeatSequence[i];

        if (b >= startSeq &&
            b <= ppgSampleSequence)
        {
          beatPositions[beatPositionCount++] =
            (uint16_t)(b - startSeq);
        }
      }
    }

    portEXIT_CRITICAL(&ppgMux);

    for (byte i = 0; i < beatPositionCount; i++)
    {
      if (i) payload += ",";
      payload += String(beatPositions[i]);
    }
  }

  payload += "]";

  payload += ",\"ppgSampleRateHz\":";
  payload += String((int)EFFECTIVE_FS_HZ);

  payload += ",\"ppgSampleSequence\":";
  payload += String((unsigned long)ppgSampleSequence);

  // Existing additive diagnostics remain unchanged.
  payload += ",\"spotRRIntervals\":";
  payload += String(spotRRCount);

  payload += ",\"validRRForHRV\":";
  payload += String(validRRForHRV);

  payload += ",\"source\":\"ESP32\"}";

  bool sent =
    notifyBLEText('V', payload, true);

  Serial.printf(
    "Vitals BLE %s (bytes=%u, physio=%s)\n",
    sent ? "TX OK" : "TX FAILED",
    (unsigned int)payload.length(),
    includePhysiologicalValues ? "yes" : "no"
  );
}

bool sendEmergencyEvent()
{
  if (!bleDeviceConnected || !bleAuthorized)
    return false;

  int emergencySpO2 =
    (CURRENT_MODE == CONTINUOUS_MODE)
      ? latestValidatedSpO2
      : finalSpO2;

  int emergencyHR =
    (CURRENT_MODE == CONTINUOUS_MODE)
      ? latestValidatedHeartRate
      : getValidatedSpotHeartRate();

  bool freshSpO2 =
    CURRENT_MODE != CONTINUOUS_MODE ||
    (latestSpO2Update &&
     millis() - latestSpO2Update <=
       CONTINUOUS_VALUE_FRESHNESS);

  bool freshHR =
    CURRENT_MODE != CONTINUOUS_MODE ||
    (latestHeartRateUpdate &&
     millis() - latestHeartRateUpdate <=
       CONTINUOUS_VALUE_FRESHNESS);

  String payload = "{";

  payload += "\"bandId\":\"";
  payload += BAND_ID;
  payload += "\",\"type\":\"fall\",\"severity\":\"HIGH\"";

  payload += ",\"spo2\":";
  jsonNullOrInt(
    payload,
    emergencySpO2,
    emergencySpO2 >= 70 &&
    emergencySpO2 <= 100 &&
    freshSpO2
  );

  payload += ",\"heartRate\":";
  jsonNullOrInt(
    payload,
    emergencyHR,
    emergencyHR >= 40 &&
    emergencyHR <= 180 &&
    freshHR
  );

  payload += ",\"hrvSDNN\":";
  uint16_t requiredHRVBeats = MIN_HRV_BEATS;

  jsonNullOrFloat(
    payload,
    hrvSDNN,
    1,
    hrvSDNN > 0 &&
    validRRForHRV >= requiredHRVBeats
  );

  payload += ",\"fallEventConfidence\":";
  payload += String(fallEventConfidence, 1);

  payload += ",\"temperature\":";
  jsonNullOrFloat(
    payload,
    temperatureC,
    2,
    temperatureSensorPresent &&
    temperatureReadingValid
  );

  payload += ",\"accelMagnitude\":";
  payload += String(
    sqrtf(
      accelX * accelX +
      accelY * accelY +
      accelZ * accelZ
    ),
    2
  );

  payload += ",\"gyroMagnitude\":";
  payload += String(
    sqrtf(
      gyroX * gyroX +
      gyroY * gyroY +
      gyroZ * gyroZ
    ),
    2
  );

  payload += ",\"tilt\":";
  payload += String(tiltAngle, 2);

  payload += ",\"transport\":\"BLE\"";
  payload += "}";

  bool sent =
    notifyBLEText('E', payload, true);

  Serial.printf(
    "Emergency BLE %s\n",
    sent ? "TX OK" : "TX FAILED"
  );

  return sent;
}

void checkMonitoringCommand()
{
  processBLEDisconnect();

  if (!bleDeviceConnected)
    return;

  // ----------------------------------------------------------
  // APPLICATION AUTHORIZATION
  // ----------------------------------------------------------

  if (bleAuthPending)
  {
    char auth[48];

    portENTER_CRITICAL(&bleCommandMux);
    strncpy(auth, blePendingAuth, sizeof(auth) - 1);
    auth[sizeof(auth) - 1] = '\0';
    blePendingAuth[0] = '\0';
    bleAuthPending = false;
    portEXIT_CRITICAL(&bleCommandMux);

    bool authorized =
      strcmp(auth, MEDJARVIS_BLE_AUTH_TOKEN) == 0;

    bleAuthorized = authorized;

    if (authorized)
    {
      Serial.println("BLE authorization accepted.");
      sendBLEAuthResult(true, "MedJarvis session authorized.");
    }
    else
    {
      Serial.println("BLE authorization rejected.");
      sendBLEAuthResult(false, "Invalid MedJarvis authorization token.");
    }
  }

  if (!bleAuthorized)
    return;

  if (!bleControlPending)
    return;

  char command[32];

  portENTER_CRITICAL(&bleCommandMux);
  strncpy(command, blePendingCommand, sizeof(command) - 1);
  command[sizeof(command) - 1] = '\0';
  portEXIT_CRITICAL(&bleCommandMux);

  String cmd = String(command);
  cmd.trim();

  // ----------------------------------------------------------
  // STOP
  // ----------------------------------------------------------

  if (cmd == "STOP")
  {
    portENTER_CRITICAL(&bleCommandMux);
    blePendingCommand[0] = '\0';
    bleControlPending = false;
    portEXIT_CRITICAL(&bleCommandMux);

    Serial.println("BLE command: STOP");

    spotAwaitingFreshStart = false;
    continuousMonitoring = false;
    monitoringActive = false;
    measurementRunning = false;

    stopContinuousAcquisitionTask();
    stopContinuousMotionTask();
    stopSensorMeasurement();

    String ack =
      "{\"type\":\"controlAck\",\"command\":\"STOP\",\"accepted\":true}";
    sendBLEStatusPayload(ack);

    return;
  }

  // ----------------------------------------------------------
  // START CONTINUOUS
  // ----------------------------------------------------------

  if (cmd == "START_CONTINUOUS")
  {
    // Preserve the existing fixed Spot acquisition behavior:
    // a Spot session is not switched midway through its 60-second
    // acquisition. The command remains pending and is applied by
    // the next main-loop pass after Spot completes.
    if (CURRENT_MODE == SPOT_MODE &&
        monitoringActive &&
        measurementRunning)
    {
      return;
    }

    if (CURRENT_MODE != CONTINUOUS_MODE &&
        monitoringActive)
    {
      continuousMonitoring = false;
      monitoringActive = false;
      measurementRunning = false;

      stopContinuousAcquisitionTask();
      stopContinuousMotionTask();
      stopSensorMeasurement();

      Serial.println("BLE command: SWITCH -> CONTINUOUS");
      return;
    }

    portENTER_CRITICAL(&bleCommandMux);
    blePendingCommand[0] = '\0';
    bleControlPending = false;
    portEXIT_CRITICAL(&bleCommandMux);

    bool wasInactive = !monitoringActive;

    CURRENT_MODE = CONTINUOUS_MODE;
    continuousMonitoring = true;
    monitoringActive = true;

    if (wasInactive)
    {
      activateSensorMeasurement();
      Serial.println("BLE command: START CONTINUOUS");

      String ack =
        "{\"type\":\"controlAck\",\"command\":\"START_CONTINUOUS\",\"accepted\":true}";
      sendBLEStatusPayload(ack);
    }

    return;
  }

  // ----------------------------------------------------------
  // START SPOT
  // ----------------------------------------------------------

  if (cmd == "START_SPOT")
  {
    if (spotAwaitingFreshStart)
    {
      portENTER_CRITICAL(&bleCommandMux);
      blePendingCommand[0] = '\0';
      bleControlPending = false;
      portEXIT_CRITICAL(&bleCommandMux);
      return;
    }

    if (CURRENT_MODE == SPOT_MODE &&
        monitoringActive)
    {
      // Duplicate START_SPOT while the same Spot session is active.
      portENTER_CRITICAL(&bleCommandMux);
      blePendingCommand[0] = '\0';
      bleControlPending = false;
      portEXIT_CRITICAL(&bleCommandMux);
      return;
    }

    if (CURRENT_MODE != SPOT_MODE &&
        monitoringActive)
    {
      // Preserve the original mode-switch behavior:
      // stop Continuous first, then let the next main-loop pass
      // start Spot from a clean state.
      continuousMonitoring = false;
      monitoringActive = false;
      measurementRunning = false;

      stopContinuousAcquisitionTask();
      stopContinuousMotionTask();
      stopSensorMeasurement();

      Serial.println("BLE command: SWITCH -> SPOT");
      return;
    }

    portENTER_CRITICAL(&bleCommandMux);
    blePendingCommand[0] = '\0';
    bleControlPending = false;
    portEXIT_CRITICAL(&bleCommandMux);

    bool wasInactive = !monitoringActive;

    CURRENT_MODE = SPOT_MODE;
    continuousMonitoring = false;
    monitoringActive = true;

    if (wasInactive)
    {
      activateSensorMeasurement();
      Serial.println("BLE command: START SPOT");

      String ack =
        "{\"type\":\"controlAck\",\"command\":\"START_SPOT\",\"accepted\":true}";
      sendBLEStatusPayload(ack);
    }

    return;
  }

  // ----------------------------------------------------------
  // PING
  // ----------------------------------------------------------

  if (cmd == "PING")
  {
    portENTER_CRITICAL(&bleCommandMux);
    blePendingCommand[0] = '\0';
    bleControlPending = false;
    portEXIT_CRITICAL(&bleCommandMux);

    sendBLEStatusPayload(
      "{\"type\":\"pong\",\"bandId\":\"BAND-MJ-001\"}"
    );
    return;
  }

  // Unknown command: clear it and report it.
  portENTER_CRITICAL(&bleCommandMux);
  blePendingCommand[0] = '\0';
  bleControlPending = false;
  portEXIT_CRITICAL(&bleCommandMux);

  Serial.print("Unknown BLE command: ");
  Serial.println(cmd);

  String error =
    "{\"type\":\"controlAck\",\"accepted\":false,\"message\":\"Unknown command.\"}";
  sendBLEStatusPayload(error);
}

void activateSensorMeasurement()
{
  if (!maxSensorPresent)
  {
    sendSensorStatus(
      "SENSOR_ERROR",
      "MAX30102 sensor is not available.",
      -1
    );
    return;
  }

  if (!tryLockI2C(pdMS_TO_TICKS(100)))
  {
    sendSensorStatus(
      "SENSOR_ERROR",
      "Unable to access the I2C sensor bus.",
      -1
    );
    return;
  }

  ledAmplitude = MAX_LED_BRIGHTNESS_START;
  maxSensor.setPulseAmplitudeRed(ledAmplitude);
  maxSensor.setPulseAmplitudeIR(ledAmplitude);
  maxSensor.setPulseAmplitudeGreen(0);
  maxSensor.clearFIFO();

  unlockI2C();

  resetBLEPPGStreamState();

  sendSensorStatus(
    "STARTING",
    "Wearable monitoring starting.",
    -1
  );

  sendSensorStatus(
    "SENSOR_READY",
    "Sensors ready.",
    -1
  );
}

void stopSensorMeasurement()
{
  if (maxSensorPresent &&
      tryLockI2C(pdMS_TO_TICKS(100)))
  {
    maxSensor.clearFIFO();
    maxSensor.setPulseAmplitudeRed(0);
    maxSensor.setPulseAmplitudeIR(0);
    maxSensor.setPulseAmplitudeGreen(0);
    unlockI2C();
  }

  measurementRunning = false;
  stableFingerDetected = false;
  fingerDetected = false;
}

void notifyMonitoringComplete()
{
  if (!bleDeviceConnected || !bleAuthorized)
    return;

  String json = "{";
  json += "\"type\":\"monitoringComplete\",";
  json += "\"bandId\":\"" + String(BAND_ID) + "\",";
  json += "\"mode\":\"";
  json +=
    (CURRENT_MODE == SPOT_MODE)
      ? "spot"
      : "continuous";
  json += "\"";
  json += "}";

  sendBLEStatusPayload(json);
}

void sendSensorStatus(
  const char* status,
  const char* message,
  int remainingSeconds
)
{
  if (strcmp(status, "MEASURING") != 0 &&
      lastSensorStatus == String(status))
    return;

  if (!bleDeviceConnected || !bleAuthorized)
    return;

  lastSensorStatus = String(status);

  String json = "{";

  json += "\"bandId\":\"" + String(BAND_ID) + "\",";
  json += "\"status\":\"" + String(status) + "\",";
  json += "\"message\":\"" + String(message) + "\",";
  json += "\"remainingSeconds\":";

  if (remainingSeconds >= 0)
    json += String(remainingSeconds);
  else
    json += "null";

  json += ",\"mode\":\"";
  json +=
    (CURRENT_MODE == CONTINUOUS_MODE)
      ? "continuous"
      : "spot";
  json += "\"";

  json += ",\"transport\":\"BLE\"";
  json += ",\"bleConnected\":";
  json += bleDeviceConnected ? "true" : "false";
  json += ",\"bleAuthorized\":";
  json += bleAuthorized ? "true" : "false";
  json += "}";

  sendBLEStatusPayload(json);
}

void resetSensorStatusState()
{
  lastSensorStatus = "";
}
