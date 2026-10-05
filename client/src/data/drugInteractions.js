/**
 * drugInteractions.js
 *
 * Curated deterministic drug interaction database.
 * Each entry describes a pair of drugs and the clinical
 * significance of combining them.
 *
 * severity: "HIGH" | "MODERATE" | "LOW"
 */

export const DRUG_INTERACTIONS = [
    // ── HIGH severity ──────────────────────────────────────
    {
        drugs: ["warfarin", "aspirin"],
        severity: "HIGH",
        effect: "Increased bleeding risk. Combination significantly elevates haemorrhagic events.",
        recommendation: "Avoid concurrent use. If unavoidable, monitor INR closely.",
    },
    {
        drugs: ["warfarin", "ibuprofen"],
        severity: "HIGH",
        effect: "NSAIDs inhibit platelet function and displace warfarin from plasma proteins, raising anticoagulation.",
        recommendation: "Use paracetamol instead. Monitor INR if NSAID is essential.",
    },
    {
        drugs: ["methotrexate", "ibuprofen"],
        severity: "HIGH",
        effect: "NSAIDs reduce renal clearance of methotrexate leading to toxicity.",
        recommendation: "Avoid. Use paracetamol for analgesia.",
    },
    {
        drugs: ["methotrexate", "aspirin"],
        severity: "HIGH",
        effect: "Salicylates displace methotrexate causing toxicity.",
        recommendation: "Avoid combination.",
    },
    {
        drugs: ["ssri", "tramadol"],
        severity: "HIGH",
        effect: "Risk of serotonin syndrome — confusion, agitation, rapid heart rate, high blood pressure.",
        recommendation: "Avoid or monitor very closely.",
    },
    {
        drugs: ["fluoxetine", "tramadol"],
        severity: "HIGH",
        effect: "Serotonin syndrome risk.",
        recommendation: "Avoid combination.",
    },
    {
        drugs: ["sertraline", "tramadol"],
        severity: "HIGH",
        effect: "Serotonin syndrome risk.",
        recommendation: "Avoid combination.",
    },
    {
        drugs: ["digoxin", "amiodarone"],
        severity: "HIGH",
        effect: "Amiodarone raises digoxin levels causing toxicity — arrhythmia, nausea.",
        recommendation: "Reduce digoxin dose by 50% and monitor levels.",
    },
    {
        drugs: ["simvastatin", "amiodarone"],
        severity: "HIGH",
        effect: "Myopathy and rhabdomyolysis risk.",
        recommendation: "Simvastatin dose should not exceed 20 mg. Consider an alternative statin.",
    },
    {
        drugs: ["clopidogrel", "omeprazole"],
        severity: "HIGH",
        effect: "Omeprazole inhibits CYP2C19 reducing clopidogrel activation significantly.",
        recommendation: "Switch to pantoprazole or rabeprazole.",
    },
    {
        drugs: ["lithium", "ibuprofen"],
        severity: "HIGH",
        effect: "NSAIDs reduce lithium renal excretion causing toxicity.",
        recommendation: "Avoid. Paracetamol is safer.",
    },
    {
        drugs: ["lithium", "diclofenac"],
        severity: "HIGH",
        effect: "Diclofenac raises lithium plasma levels.",
        recommendation: "Monitor lithium levels closely or use alternative analgesic.",
    },
    {
        drugs: ["ciprofloxacin", "theophylline"],
        severity: "HIGH",
        effect: "Ciprofloxacin markedly inhibits theophylline metabolism causing toxicity.",
        recommendation: "Avoid. Reduce theophylline dose if combination essential.",
    },
    {
        drugs: ["clarithromycin", "simvastatin"],
        severity: "HIGH",
        effect: "Macrolide inhibits CYP3A4 drastically raising simvastatin levels — rhabdomyolysis.",
        recommendation: "Stop simvastatin during clarithromycin course.",
    },
    {
        drugs: ["sildenafil", "nitrate"],
        severity: "HIGH",
        effect: "Severe hypotension.",
        recommendation: "Absolute contraindication.",
    },
    {
        drugs: ["sildenafil", "isosorbide"],
        severity: "HIGH",
        effect: "Severe hypotension.",
        recommendation: "Absolute contraindication.",
    },
    {
        drugs: ["mao inhibitor", "pethidine"],
        severity: "HIGH",
        effect: "Risk of fatal serotonin syndrome and cardiovascular collapse.",
        recommendation: "Absolute contraindication.",
    },
    {
        drugs: ["phenelzine", "tramadol"],
        severity: "HIGH",
        effect: "Serotonin syndrome.",
        recommendation: "Absolute contraindication.",
    },
    {
        drugs: ["ketoconazole", "cisapride"],
        severity: "HIGH",
        effect: "QT prolongation and risk of fatal arrhythmia.",
        recommendation: "Absolute contraindication.",
    },

    // ── MODERATE severity ─────────────────────────────────
    {
        drugs: ["metformin", "contrast dye"],
        severity: "MODERATE",
        effect: "Risk of lactic acidosis when contrast media reduce renal function.",
        recommendation: "Hold metformin 48 h before and after contrast procedures.",
    },
    {
        drugs: ["warfarin", "paracetamol"],
        severity: "MODERATE",
        effect: "High-dose paracetamol (>2 g/day) may slightly elevate INR.",
        recommendation: "Monitor INR with regular paracetamol use.",
    },
    {
        drugs: ["amlodipine", "simvastatin"],
        severity: "MODERATE",
        effect: "Amlodipine raises simvastatin exposure; myopathy risk.",
        recommendation: "Limit simvastatin to 20 mg/day.",
    },
    {
        drugs: ["atenolol", "verapamil"],
        severity: "MODERATE",
        effect: "Additive bradycardia and heart block.",
        recommendation: "Monitor heart rate and use with caution.",
    },
    {
        drugs: ["metronidazole", "alcohol"],
        severity: "MODERATE",
        effect: "Disulfiram-like reaction — flushing, vomiting, tachycardia.",
        recommendation: "Avoid alcohol during and 48 h after metronidazole.",
    },
    {
        drugs: ["fluconazole", "warfarin"],
        severity: "MODERATE",
        effect: "Fluconazole inhibits CYP2C9 raising warfarin levels.",
        recommendation: "Monitor INR; reduce warfarin dose as needed.",
    },
    {
        drugs: ["doxycycline", "antacid"],
        severity: "MODERATE",
        effect: "Calcium, magnesium and aluminium salts chelate doxycycline reducing absorption.",
        recommendation: "Separate administration by at least 2–3 hours.",
    },
    {
        drugs: ["rifampicin", "oral contraceptive"],
        severity: "MODERATE",
        effect: "Rifampicin induces enzymes reducing contraceptive efficacy.",
        recommendation: "Use additional contraception during and for 4 weeks after rifampicin.",
    },
    {
        drugs: ["phenytoin", "carbamazepine"],
        severity: "MODERATE",
        effect: "Unpredictable interaction — may raise or lower levels of both.",
        recommendation: "Monitor drug levels closely.",
    },
    {
        drugs: ["ace inhibitor", "potassium supplement"],
        severity: "MODERATE",
        effect: "Hyperkalaemia risk.",
        recommendation: "Monitor serum potassium regularly.",
    },
    {
        drugs: ["ramipril", "spironolactone"],
        severity: "MODERATE",
        effect: "Hyperkalaemia risk.",
        recommendation: "Monitor potassium levels.",
    },
    {
        drugs: ["furosemide", "gentamicin"],
        severity: "MODERATE",
        effect: "Additive ototoxicity and nephrotoxicity.",
        recommendation: "Avoid combination; if necessary monitor renal function and hearing.",
    },
    {
        drugs: ["ciprofloxacin", "antacid"],
        severity: "MODERATE",
        effect: "Antacids chelate ciprofloxacin reducing absorption by up to 90%.",
        recommendation: "Take ciprofloxacin 2 h before or 6 h after antacid.",
    },

    // ── LOW severity ──────────────────────────────────────
    {
        drugs: ["aspirin", "ibuprofen"],
        severity: "LOW",
        effect: "Ibuprofen may reduce the antiplatelet effect of low-dose aspirin.",
        recommendation: "Take aspirin at least 30 min before ibuprofen.",
    },
    {
        drugs: ["atorvastatin", "grapefruit"],
        severity: "LOW",
        effect: "Grapefruit inhibits CYP3A4 slightly raising atorvastatin levels.",
        recommendation: "Avoid large amounts of grapefruit juice.",
    },
];

// ─────────────────────────────────────────────────────────────
// checkInteractions()
//
// Given an array of medicine name strings, returns all
// interactions found in the database (case-insensitive, partial
// match).
//
// Returns: Array of interaction objects found
// ─────────────────────────────────────────────────────────────

export function checkInteractions(medicineNames) {
    if (!Array.isArray(medicineNames) || medicineNames.length < 2) {
        return [];
    }

    const normalised = medicineNames.map((n) => n.toLowerCase().trim());

    const found = [];

    for (const interaction of DRUG_INTERACTIONS) {
        const [drugA, drugB] = interaction.drugs;

        const aMatch = normalised.some((n) => n.includes(drugA));
        const bMatch = normalised.some((n) => n.includes(drugB));

        if (aMatch && bMatch) {
            found.push(interaction);
        }
    }

    return found;
}

export const SEVERITY_RANK = { HIGH: 3, MODERATE: 2, LOW: 1 };
