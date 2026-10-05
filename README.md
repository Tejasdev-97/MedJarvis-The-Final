# 🩺 MedJarvis — AI-Powered Smart Healthcare Ecosystem

> **Academic Healthcare Prototype & Demonstration Platform**  
> *A unified digital health platform integrating patient consent management, multi-role clinical workflows, ESP32 wearable BLE monitoring, deterministic drug interaction safety, and AI-assisted health summarization.*

---

## 📌 1. Overview

**MedJarvis** is a comprehensive full-stack healthcare ecosystem designed to address critical challenges in rural and clinical healthcare delivery. The platform connects Patients, Doctors, Health Workers, Hospital Managers, Ambulance Staff, and Super Admins into a single interconnected system.

Unlike traditional electronic health record (EHR) software that grants blanket access to healthcare providers, MedJarvis implements a **Patient-Controlled Consent Gate** paired with **Legitimate Care Relationship Scoping**. Patients retain absolute ownership over their medical data, granting temporary, time-bound, and scoped access to authorized clinicians while preserving longitudinal care history.

---

## 🎯 2. Core Objectives

- **Patient Empowerment & Data Privacy**: Give patients total visibility and control over who accesses their medical records, for how long, and for what purpose.
- **Role-Gated Clinical Workflows**: Provide tailored dashboards and toolsets for 6 distinct healthcare roles without compromising access boundaries.
- **Hardware-Integrated Health Monitoring**: Stream live physiological vitals (Heart Rate, SpO2, Body Temperature, Motion/Fall Detection) directly from an ESP32 wearable band over Web Bluetooth (BLE).
- **Medication Safety & Interaction Engine**: Intercept risky drug combinations using a deterministic Drug Interaction Checker and the local MedJarvis Drug Information Registry.
- **Assistive AI Summarization**: Provide clear, easy-to-understand health summaries for patients using Google Gemini AI, strictly scoped as assistive decision support.
- **Emergency Break-Glass Response**: Enable Ambulance Staff and Emergency Responders to bypass normal consent gates during critical life-threatening situations with strict audit logging.

---

## 🏗️ 3. Current System Architecture

MedJarvis is structured as a monorepo containing a React frontend, Node/Express backend, ESP32 firmware, and project documentation:

```
                      ┌─────────────────────────────────────────┐
                      │          ESP32 Wearable Band            │
                      │  MAX30102 | MPU6050 | DS18B20 | TP4056   │
                      └────────────────────┬────────────────────┘
                                           │ Web Bluetooth (BLE)
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 MedJarvis Web Client                                   │
│                        React 18 | Vite | Tailwind CSS | Lucide                         │
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           │ HTTPS / REST API / JWT
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                Node.js / Express Server                                │
│        Auth Middleware | Role Middleware | requirePatientAccess | Audit Logger         │
└──────────────────┬───────────────────────┬──────────────────────────────┬──────────────┘
                   │                       │                              │
                   ▼                       ▼                              ▼
        ┌──────────────────────┐┌──────────────────────┐      ┌─────────────────────┐
        │    MongoDB Atlas     ││    Google Gemini     │      │   Fast2SMS Gateway  │
        │ Mongoose Collections ││  AI Summary Engine   │      │  Emergency SMS Alerts│
        └──────────────────────┘└──────────────────────┘      └─────────────────────┘
```

---

## ⭐ 4. Key Platform Features

- **6-Role Custom Dashboards**: Tailored user experience for Patient, Doctor, Health Worker, Ambulance Staff, Hospital Manager, and Super Admin.
- **Patient-Controlled Consent Gate**: Digital approval, physical 6-digit Consent PIN fallback, and instant Provider QR scanning.
- **Legitimate Relationship Directory**: "My Patients" lists historical care relationships without exposing protected medical records unless active consent exists.
- **Shared Health Monitoring Hub**: Real-time Spot (60-second high accuracy) and Continuous BLE monitoring for Doctors and Health Workers.
- **QR Health Card System**: Encrypted patient QR identification cards with allergy indicators, emergency contacts, and version control.
- **Provider Consent QR**: Doctors and Hospitals present a session QR code that patients scan to immediately grant access.
- **Deterministic Drug Interaction Checker**: Real-time cross-referencing of prescribed medications against standard contraindication registries.
- **Assistive AI Health Summaries**: Gemini-powered medical timeline summarization tailored for patient comprehension.
- **Audit Ledger & Privacy Dashboard**: Tamper-evident logging of every profile view, vitals capture, data request, consent grant, and break-glass event.

---

## 👥 5. User Roles & Capabilities

| Role | Primary Responsibilities & Permitted Workflows |
| :--- | :--- |
| **Super Admin** | Platform oversight, hospital management, Hospital Manager profile creation, global directory inspection, full audit log access. *(No direct patient care workflows).* |
| **Hospital Manager** | Staff profile creation (Doctor, Health Worker, Ambulance, Staff), hospital-scoped patient directory, patient registration, staff bulk import. |
| **Health Worker** | Rural/field patient registration, patient bulk import, care history lookup, patient scanning, shared Health Monitoring. |
| **Doctor** | Legitimate relationship care history, patient scanning, Provider QR presentation, shared Health Monitoring, clinical visit notes, prescription authoring. *(Doctor role CANNOT edit or delete patient profiles).* |
| **Ambulance Staff** | Emergency scan, emergency cases dashboard, 2-hour Break-Glass emergency override access with mandatory reason entry. |
| **Patient** | Personal health dashboard, QR Health Card, medical history, prescriptions, external records, AI health summary, Privacy Center (grant management, PIN rotation, audit ledger, provider QR scanner), emergency alert trigger. |

---

## 🔐 6. Patient Relationship + Consent Architecture

A foundational principle of MedJarvis is the strict conceptual separation between **Care Relationships** and **Active Consent**:

$$\text{RELATIONSHIP} \neq \text{CONSENT}$$

```
LEGITIMATE CARE RELATIONSHIP  ──>  Patient appears in "My Patients" card list
                                              │
                                              ▼
                                   ACTIVE CONSENT GRANT?
                                    ├── YES ──> View Profile, Vitals, Prescriptions, AI Summary, Monitoring
                                    └── NO  ──> Medical Data Blocked | "Request Access" Button Displayed
```

### Key Security Enforcement Rules:
1. **Card Visibility $\neq$ Access**: A patient card appearing in a doctor's list does NOT allow viewing medical data unless an active `AccessGrant` exists.
2. **Identification $\neq$ Consent**: Scanning a patient QR or searching by MedJarvis ID identifies the patient but does NOT grant access to clinical records.
3. **Anti-Enumeration Search**: Providers cannot search for or discover arbitrary patients by phone number, name, or MedJarvis ID unless a legitimate historical relationship exists (`AccessGrant` history, `createdBy`, `DoctorVisit`, `Prescription`, or `VitalReading`).
4. **Facility Isolation**: Shared hospital membership alone does NOT establish a doctor-patient relationship.
5. **Server-Side Authorization**: Every protected endpoint (`/api/patients/:id`, `/api/vitals/*`, etc.) is guarded by the `requirePatientAccess` middleware. Frontend button hiding is purely cosmetic; backend enforcement is authoritative.

---

## 🔄 7. Patient Access Workflow

```
┌─────────────────┐       ┌──────────────────────┐       ┌─────────────────────┐
│  Provider Finds │ ───>  │ Send Access Request  │ ───>  │  Patient Notified   │
│   / Scans Patient│       │  or Enter Consent PIN│       │   in Privacy Center │
└─────────────────┘       └──────────────────────┘       └──────────┬──────────┘
                                                                    │
                                                                 Approve
                                                                    │
┌─────────────────┐       ┌──────────────────────┐       ┌──────────▼──────────┐
│ Access Expires  │ <───  │ Protected Access     │ <───  │ Active AccessGrant  │
│  or is Revoked  │       │ Granted (Scoped/Time)│       │ Created in DB       │
└─────────────────┘       └──────────────────────┘       └─────────────────────┘
```

1. **Identification**: Provider locates patient via care history search or QR scan.
2. **Request**: Provider selects required data categories (`PROFILE`, `VITALS`, `PRESCRIPTIONS`, etc.) and duration (e.g., 4 hrs, 24 hrs, 3 days).
3. **Approval**: Patient approves request in Privacy Center (or provider inputs patient's 6-digit physical Consent PIN).
4. **Active Grant**: An `AccessGrant` record with status `ACTIVE` and an expiration timestamp is created.
5. **Access**: Provider gains access to authorized patient tabs.
6. **Expiration**: Upon reaching `expiresAt` (or manual patient revocation), status transitions to `EXPIRED`/`REVOKED`. Backend immediately blocks further clinical API calls. The patient remains in the provider's `My Patients` list with a **Request Access** prompt.

---

## 🫀 8. Health Monitoring & Wearable Architecture

### Shared Health Monitoring Module (`/monitoring`)
Both **Doctor** and **Health Worker** roles have access to the `Health Monitoring` sidebar module. The monitoring interface does not globally list patients; it requires selecting an authorized patient with active consent before initializing the BLE wearable interface.

### ESP32 Hardware Specs & Components
- **Microcontroller**: ESP32 Dual-Core 240MHz (Bluetooth Low Energy 4.2 / 5.0).
- **Pulse Oximeter & Heart Rate**: MAX30102 (IR/Red PPG optical sensor).
- **Body Temperature Sensor**: DS18B20 (Digital probe sensor).
- **Motion & Fall Sensor**: MPU6050 (6-axis Accelerometer + Gyroscope).
- **Power & Charging**: TP4056 LiPo Charging Module with 3.7V Rechargeable Battery.

```
       [MAX30102] ──(I2C: SDA/SCL)──┐
       [MPU6050]  ──(I2C: SDA/SCL)──┼──> [ESP32] ──(BLE GATT Stream)──> [Browser Web BLE]
       [DS18B20]  ──(OneWire: D4)  ──┤
       [TP4056]   ──(BAT+ / BAT-)  ──┘
```

### Device Identity & Session Binding
Wearable bands use a standardized device identifier (e.g., `BAND-MJ-001`). Devices are **reusable** and are dynamically bound to a patient for the duration of a monitoring session rather than permanently assigned to a single patient account.

---

## 📊 9. Spot & Continuous Monitoring Modes

### Spot Monitoring Mode
- **Duration**: 60-second high-accuracy sample window (`SPOT_DURATION = 60000ms`).
- **Operation**: Collects stable PPG waveforms, calculates average Heart Rate (BPM), Blood Oxygen Saturation ($\text{SpO}_2\%$), and Body Temperature ($^\circ\text{C}$).
- **Output**: Generates a single validated reading summary and prompts to save to the patient's longitudinal history.

### Continuous Monitoring Mode
- **Duration**: Ongoing real-time data stream.
- **Operation**: Streams live vitals at regular intervals, evaluates continuous PPG stability, monitors accelerometer thresholds for sudden high-impact fall events, and alerts the user interface dynamically.

---

## 💾 10. VitalReading Persistence & Provenance

All physiological readings captured by patients, health workers, or doctors are persisted in a single MongoDB collection (`VitalReading`). Longitudinal records maintain full provenance tracking to record the context under which every measurement was taken:

```javascript
{
  "_id": ObjectId("..."),
  "patient": ObjectId("..."),
  "heartRate": 74,
  "spo2": 98,
  "temperature": 36.8,
  "recordedByProfile": ObjectId("..."),
  "recordedByRole": "DOCTOR",             // DOCTOR | HEALTH_WORKER | PATIENT
  "hospital": "City Central Hospital",
  "measurementSource": "ESP32_BAND",       // ESP32_BAND | MANUAL_ENTRY
  "measurementContext": "CLINICAL_MONITORING", // CLINICAL_MONITORING | FIELD_VISIT | SELF_MONITORING
  "accessGrant": ObjectId("..."),
  "recordedAt": ISODate("2026-10-06T00:00:00Z")
}
```

> ⚠️ **Data Integrity Rule**: Expiration or revocation of an `AccessGrant` does **NOT** delete previously recorded `VitalReading` data. It only restricts future provider access.

---

## 🚨 11. Emergency / Break-Glass Access

For life-threatening emergencies where a patient is unconscious or unable to provide consent:

- **Authorized Roles**: Ambulance Staff, Doctor, Super Admin.
- **Mechanism**: Invokes POST `/api/access-grants/emergency` with a required `emergencyReason`.
- **Grant Behavior**: Instantly generates an `AccessGrant` with status `EMERGENCY`, `isEmergency: true`, duration of **2 hours**, and restricted scope (`EMERGENCY_BASIC`, `ALLERGIES`, `PROFILE`).
- **Audit & Notification**: Triggers high-priority audit logs (`EMERGENCY_ACCESS`) and optional Fast2SMS alert dispatch to emergency contacts.

---

## 📋 12. QR Health Card & Provider QR Systems

MedJarvis implements two distinct QR workflows:

1. **Patient QR Health Card**:
   - Displayed on Patient Dashboard and Health Card page.
   - Encodes patient `medJarvisId`, basic identity, blood group, emergency contact, and allergies.
   - Scanning identifies the patient without automatically granting medical data access.
2. **Provider / Hospital Consent QR**:
   - Presented by Doctors or Hospital Managers on their dashboard or profile.
   - Encodes Provider Profile ID and Facility details (contains **NO** patient medical data).
   - Patients scan this QR from their Privacy Center or Dashboard to launch an instant consent grant dialog.

---

## 💊 13. Prescriptions & Drug Interaction Safety

- **Clinical Prescriptions**: Doctors author structured prescriptions including medicine name, dosage, frequency, duration, and clinical instructions.
- **Deterministic Interaction Checker**: Cross-references newly prescribed medications against the patient's active medication list using the local **MedJarvis Drug Information Registry** (`DrugRegistry`).
- **Safety Interception**: Flags severe contraindications, drug-drug interactions, and known patient allergies prior to finalizing the prescription.

---

## 🤖 14. Assistive AI Health Summarization

- **Provider**: Powered by Google Gemini AI (`@google/genai`).
- **Function**: Analyzes patient medical history, visit notes, prescriptions, and longitudinal vitals to generate structured, easy-to-understand health summaries.
- **Safety & Scope Disclaimer**: The AI module is strictly designated as **assistive decision support**. It does not perform autonomous medical diagnosis or prescribe treatments independently.

---

## 📄 15. External Records & Document Repository

- **Patient Records Hub**: Enables patients and authorized clinical staff to upload external medical documents (PDFs, lab reports, imaging studies, discharge summaries).
- **Metadata Tracking**: Preserves document category, issuing facility, date of document, and uploader provenance (`uploadedByProfile`).
- **Access Control**: Document viewing and download endpoints are protected by `requirePatientAccess({ scope: "EXTERNAL_RECORDS" })`.

---

## 🔒 16. Privacy Center & Tamper-Evident Audit Ledger

Located in the Patient navigation, the **Privacy Center** allows patients to:
- Review all currently active access grants and revoke access with one click.
- Inspect pending digital access requests from doctors and approve or deny them.
- Set up or rotate their physical 6-digit **Consent PIN**.
- Open the built-in QR scanner to scan a Doctor/Hospital QR.
- View a complete, chronological **Audit Ledger** recording every access event, profile view, vitals reading, and emergency override.

---

## ⚙️ 17. Technology Stack

### Frontend (`/client`)
- **Framework**: React 18.3 + Vite 6.0
- **Styling**: Tailwind CSS + Vanilla CSS Tokens
- **Icons**: Lucide React
- **HTTP Client**: Axios (with JWT Interceptors)
- **Hardware Interface**: Web Bluetooth API (`navigator.bluetooth`)
- **Routing**: React Router DOM 6

### Backend (`/server`)
- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js 4.21
- **Database**: MongoDB Atlas via Mongoose 8.8
- **Authentication**: JSON Web Tokens (`jsonwebtoken`) + `bcryptjs`
- **AI Integration**: `@google/genai` SDK
- **Logging**: Custom MongoDB-backed Audit Logger

### Hardware Firmware (`/hardware`)
- **Board**: ESP32 Development Module
- **Language/IDE**: C++ / Arduino Framework
- **Protocols**: I2C (MAX30102, MPU6050), OneWire (DS18B20), BLE GATT (Custom Service & Characteristic UUIDs)

---

## 📁 18. Repository Structure

```
MedJarvis/
├── client/                      # React + Vite Frontend
│   ├── public/                  # Static assets & icons
│   ├── src/
│   │   ├── components/          # UI components (auth, dashboard, qr, patients, users, bulk, settings)
│   │   ├── context/             # React Context (AuthContext, LanguageContext)
│   │   ├── data/                # Static navigation & menu definitions
│   │   ├── locales/             # Multilingual translation dictionaries
│   │   ├── pages/               # Role-specific application pages
│   │   ├── routes/              # AppRouter & ProtectedRoute definitions
│   │   ├── services/            # Axios API wrappers & BLE driver (bleBand.js)
│   │   ├── styles/              # Design tokens & CSS styles
│   │   ├── App.jsx              # Root component
│   │   └── main.jsx             # React entry point
│   ├── .env.example             # Frontend environment template
│   ├── package.json
│   └── vite.config.js
│
├── server/                      # Node.js + Express Backend
│   ├── config/                  # Database connection (db.js)
│   ├── controllers/             # Business logic controllers
│   ├── middleware/              # authMiddleware, roleMiddleware, requirePatientAccess
│   ├── models/                  # Mongoose Schemas (16 collections)
│   ├── routes/                  # Express API route modules
│   ├── services/                # Gemini AI & external services
│   ├── utils/                   # ID generators & audit log utility
│   ├── .env.example             # Backend environment template
│   ├── package.json
│   └── server.js                # Express app entry point
│
├── hardware/                    # ESP32 C++ Firmware
│   └── DualMode_Fixed_Code/     # Production BLE Firmware source code
│
├── docs/                        # Technical documentation & diagrams
├── .gitignore                   # Root Git ignore rules
└── README.md                    # Project master documentation
```

---

## 🛠️ 19. Environment Variables Setup

### Client (`client/.env.example`)
```env
# Backend API Base URL
VITE_API_URL=http://localhost:5000/api

# Google Cloud Translation API Key (Optional frontend fallback)
VITE_GOOGLE_TRANSLATE_API_KEY=your_google_cloud_translation_api_key_here
```

### Server (`server/.env.example`)
```env
# Server Port
PORT=5000

# MongoDB Atlas Connection String
MONGODB_URI=your_mongodb_connection_string_here

# JWT Signing Secret
JWT_SECRET=your_jwt_secret_key_here

# Google Gemini AI Key & Model
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash-lite

# Google Cloud Translation Key (Backend proxy)
GOOGLE_TRANSLATE_API_KEY=your_google_cloud_translation_api_key_here

# Fast2SMS API Key (Optional SMS Emergency Alerts)
FAST2SMS_API_KEY=your_fast2sms_api_key_here
```

---

## 🚀 20. Local Development Setup

### Prerequisites
- **Node.js**: `v18.x` or `v20.x`
- **npm**: `v9.x` or higher
- **MongoDB**: Active MongoDB Atlas cluster or local MongoDB instance
- **Browser**: Google Chrome / Microsoft Edge (required for Web Bluetooth API support)

### Installation Steps

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/Tejasdev-97/MedJarvis-The-Final.git
   cd MedJarvis-The-Final
   ```

2. **Configure Server Environment**:
   ```bash
   cd server
   cp .env.example .env
   # Edit .env and supply your MONGODB_URI, JWT_SECRET, and GEMINI_API_KEY
   npm install
   npm run dev
   ```
   *Backend will start on `http://localhost:5000`.*

3. **Configure Client Environment**:
   ```bash
   cd ../client
   cp .env.example .env
   npm install
   npm run dev
   ```
   *Frontend dev server will start on `http://localhost:5173`.*

---

## 📦 21. Build & Production Verification

To build and validate the application for production deployment:

```bash
# Validate Server Syntax
cd server
node --check server.js

# Build Frontend Bundle
cd ../client
npm run build
```

---

## 🌐 22. Deployment Architecture

MedJarvis is designed for unified single-repository development with decoupled cloud hosting:

```
                               ┌───────────────────────────┐
                               │   GitHub Repository       │
                               │  MedJarvis-The-Final.git  │
                               └─────────────┬─────────────┘
                                             │
                      ┌──────────────────────┴──────────────────────┐
                      ▼                                             ▼
          ┌──────────────────────┐                      ┌──────────────────────┐
          │   Vercel Deployment  │                      │  Render Deployment   │
          │    (client/ root)    │                      │    (server/ root)    │
          └──────────────────────┘                      └──────────┬───────────┘
                                                                   │
                                                                   ▼
                                                        ┌──────────────────────┐
                                                        │  MongoDB Atlas DB    │
                                                        └──────────────────────┘
```

---

## ⚠️ 23. Academic Prototype Disclaimer

> **DISCLAIMER**: MedJarvis is developed as an **academic prototype and demonstration platform** for final-year engineering evaluation. It is **not** a certified medical device and is not intended for standalone diagnostic, surgical, or emergency clinical decision-making without licensed medical professional oversight.

---

## 🔮 24. Future Scope & Roadmap

- **Native Mobile BLE Integration**: Expand Web Bluetooth browser support to native iOS/Android applications using Capacitor / React Native BLE PLX.
- **Offline Sync & PWA Cache**: Implement local IndexedDB storage for rural health workers operating in low-connectivity areas.
- **Automated WebPush / FCM Notifications**: Push real-time consent request and vital alert notifications directly to mobile devices.