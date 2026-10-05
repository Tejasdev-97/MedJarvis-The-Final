import { useState, useMemo, useRef, useEffect } from "react";
import {
    Upload,
    FileSpreadsheet,
    X,
    CheckCircle2,
    AlertTriangle,
    AlertCircle,
    RotateCcw,
    Check,
    Download,
    Eye,
} from "lucide-react";
import * as XLSX from "xlsx";
import api from "../../services/api";

export default function BulkImportModal({ open, onClose, onSuccess, defaultEntity = "Patients" }) {
    let profile = {};
    try {
        const raw = localStorage.getItem("profile");
        if (raw && raw !== "undefined" && raw !== "null") {
            profile = JSON.parse(raw);
        }
    } catch (e) {
        profile = {};
    }
    const role = profile.role || "Health Worker";

    // Role-based entity permission configuration
    const permittedEntities = useMemo(() => {
        if (role === "Super Admin" || role === "Hospital Manager") {
            return ["Patients", "Doctors", "Health Workers", "Staff"];
        }
        if (role === "Health Worker" || role === "Doctor") {
            return ["Patients"];
        }
        return ["Patients"];
    }, [role]);

    const [entityType, setEntityType] = useState(defaultEntity);
    const [stage, setStage] = useState("UPLOAD"); // UPLOAD | PREVIEW | IMPORTING | RESULTS
    const [fileInfo, setFileInfo] = useState(null);
    const [parsedRows, setParsedRows] = useState([]);
    const [editingCell, setEditingCell] = useState(null); // { rowIndex, colKey }
    const [reviewConfirmed, setReviewConfirmed] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [errorMsg, setErrorMsg] = useState("");

    const fileInputRef = useRef(null);

    useEffect(() => {
        if (open) {
            setEntityType(defaultEntity);
            setStage("UPLOAD");
            setFileInfo(null);
            setParsedRows([]);
            setEditingCell(null);
            setReviewConfirmed(false);
            setImporting(false);
            setImportResult(null);
            setErrorMsg("");
        }
    }, [open, defaultEntity]);

    // Reset workflow state
    const handleReset = () => {
        setStage("UPLOAD");
        setFileInfo(null);
        setParsedRows([]);
        setEditingCell(null);
        setReviewConfirmed(false);
        setImporting(false);
        setImportResult(null);
        setErrorMsg("");
    };

    // ================================================================
    // HEADER NORMALIZATION
    // ================================================================
    const normalizeHeader = (h) => {
        const clean = String(h || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        if (clean.includes("firstname") || clean.includes("first")) return "firstName";
        if (clean.includes("lastname") || clean.includes("last") || clean.includes("surname")) return "lastName";
        if (clean.includes("name") && !clean.includes("emergency") && !clean.includes("kin")) return "firstName";
        if (clean.includes("phone") || clean.includes("mobile") || clean.includes("contact")) return "phone";
        if (clean.includes("emergency") || clean.includes("kin")) return "emergencyContact";
        if (clean.includes("age") || clean.includes("years")) return "age";
        if (clean.includes("gender") || clean.includes("sex")) return "gender";
        if (clean.includes("blood")) return "bloodGroup";
        if (clean.includes("village") || clean.includes("town") || clean.includes("city")) return "village";
        if (clean.includes("address") || clean.includes("location") || clean.includes("street")) return "address";
        if (clean.includes("aadhaar") || clean.includes("adhar")) return "aadhaarNumber";
        if (clean.includes("pincode") || clean.includes("zip")) return "pincode";
        if (clean.includes("state")) return "state";
        if (clean.includes("district")) return "district";
        if (clean.includes("dob") || clean.includes("birth")) return "dateOfBirth";
        if (clean.includes("empid") || clean.includes("employee")) return "employeeId";
        if (clean.includes("hospital")) return "hospital";
        return String(h || "").trim();
    };

    // ================================================================
    // 1. CSV / TEXT PARSER
    // ================================================================
    const parseCSVContent = (content) => {
        const lines = content.split(/\r\n|\n/).filter(line => line.trim().length > 0);
        if (lines.length < 2) {
            throw new Error("CSV file must contain a header row and at least one data row.");
        }

        const rawHeaders = parseCSVLine(lines[0]);
        const rows = [];

        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            if (values.length === 0 || (values.length === 1 && !values[0])) continue;

            const rowData = { _id: i, _action: "AUTO", _edited: {} };

            rawHeaders.forEach((header, colIdx) => {
                const normalizedKey = normalizeHeader(header);
                const rawVal = (values[colIdx] || "").trim();
                rowData[normalizedKey] = rawVal;
            });

            rows.push(rowData);
        }

        return { headers: rawHeaders, rows };
    };

    const parseCSVLine = (text) => {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(cur.trim());
                cur = '';
            } else {
                cur += char;
            }
        }
        result.push(cur.trim());
        return result;
    };

    // ================================================================
    // 2. BINARY EXCEL (XLSX / XLS) PARSER
    // ================================================================
    const parseExcelContent = (arrayBuffer) => {
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error("Excel file contains no readable worksheets.");
        }

        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });

        const validRows = rawData.filter(r => Array.isArray(r) && r.some(cell => String(cell).trim().length > 0));

        if (validRows.length < 2) {
            throw new Error("Excel sheet must contain a header row and at least one data row.");
        }

        const rawHeaders = validRows[0].map(cell => String(cell).trim());
        const rows = [];

        for (let i = 1; i < validRows.length; i++) {
            const cellValues = validRows[i];
            const rowData = { _id: i, _action: "AUTO", _edited: {} };

            rawHeaders.forEach((header, colIdx) => {
                const normalizedKey = normalizeHeader(header);
                const val = cellValues[colIdx] !== undefined && cellValues[colIdx] !== null ? String(cellValues[colIdx]).trim() : "";
                rowData[normalizedKey] = val;
            });

            rows.push(rowData);
        }

        return { headers: rawHeaders, rows };
    };

    // ================================================================
    // 3. STRUCTURED PDF TABLE PARSER
    // ================================================================
    const parsePDFTable = async (arrayBuffer) => {
        const pdfjsLib = await import("pdfjs-dist/build/pdf.js").catch(() => import("pdfjs-dist"));
        const pdfjs = pdfjsLib.default || pdfjsLib;
        if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
            pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
        }
        const loadingTask = pdfjs.getDocument ? pdfjs.getDocument({ data: arrayBuffer }) : (pdfjsLib.getDocument ? pdfjsLib.getDocument({ data: arrayBuffer }) : null);
        if (!loadingTask) throw new Error("PDF parser library failed to load in browser context.");
        const pdf = await loadingTask.promise;
        let allTextItems = [];

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            const items = textContent.items
                .map(item => ({
                    str: item.str.trim(),
                    x: Math.round(item.transform[4]),
                    y: Math.round(item.transform[5]),
                }))
                .filter(item => item.str.length > 0);

            allTextItems = allTextItems.concat(items);
        }

        if (allTextItems.length === 0) {
            throw new Error("Could not detect a structured table in this PDF.");
        }

        // Group text items by Y position (line)
        const lineMap = new Map();
        allTextItems.forEach(item => {
            let foundY = null;
            for (const yKey of lineMap.keys()) {
                if (Math.abs(yKey - item.y) <= 4) {
                    foundY = yKey;
                    break;
                }
            }
            const lineY = foundY !== null ? foundY : item.y;
            if (!lineMap.has(lineY)) lineMap.set(lineY, []);
            lineMap.get(lineY).push(item);
        });

        // Sort lines from top to bottom (descending Y in PDF coordinates)
        const sortedYKeys = Array.from(lineMap.keys()).sort((a, b) => b - a);

        const tableRows = [];
        sortedYKeys.forEach(yKey => {
            const lineItems = lineMap.get(yKey);
            lineItems.sort((a, b) => a.x - b.x); // sort left to right

            const rowCells = lineItems.map(item => item.str);
            if (rowCells.length >= 2) { // Structured table line has at least 2 columns
                tableRows.push(rowCells);
            }
        });

        if (tableRows.length < 2) {
            throw new Error("Could not detect a structured table in this PDF.");
        }

        const rawHeaders = tableRows[0];
        const rows = [];

        for (let i = 1; i < tableRows.length; i++) {
            const rowCells = tableRows[i];
            const rowData = { _id: i, _action: "AUTO", _edited: {} };

            rawHeaders.forEach((header, colIdx) => {
                const normalizedKey = normalizeHeader(header);
                rowData[normalizedKey] = (rowCells[colIdx] || "").trim();
            });

            rows.push(rowData);
        }

        return { headers: rawHeaders, rows };
    };

    // ================================================================
    // UNIFIED FILE UPLOAD HANDLER FOR CSV, XLSX, XLS, PDF
    // ================================================================
    const handleFileUpload = async (file) => {
        if (!file) return;

        const ext = file.name.split('.').pop().toLowerCase();
        if (!["csv", "txt", "xlsx", "xls", "pdf"].includes(ext)) {
            setErrorMsg("Unsupported file format. Please upload a .csv, .xlsx, .xls, or .pdf file.");
            return;
        }

        setErrorMsg("");

        try {
            let result;
            if (ext === "csv" || ext === "txt") {
                const text = await file.text();
                result = parseCSVContent(text);
            } else if (ext === "xlsx" || ext === "xls") {
                const buffer = await file.arrayBuffer();
                result = parseExcelContent(buffer);
            } else if (ext === "pdf") {
                const buffer = await file.arrayBuffer();
                result = await parsePDFTable(buffer);
            }

            if (!result || !result.rows || result.rows.length === 0) {
                throw new Error("No data rows extracted from file.");
            }

            setFileInfo({
                name: file.name,
                size: `${(file.size / 1024).toFixed(1)} KB`,
                rowCount: result.rows.length,
            });

            setParsedRows(result.rows);
            setStage("PREVIEW");
        } catch (err) {
            console.error("File parsing error:", err);
            setErrorMsg(err.message || "Failed to parse file.");
        }
    };

    // Sample CSV Generator for convenience
    const downloadSampleCSV = () => {
        let sampleContent = "";
        if (entityType === "Patients") {
            sampleContent = "First Name,Last Name,Phone,Age,Gender,Blood Group,Emergency Contact,Village,Address\n" +
                "Ramesh,Kumar,9876543210,45,Male,O+,9876543211,Ramanagara,Main Street House #12\n" +
                "Suresh,Patil,9876543212,52,Male,A+,9876543213,Channapatna,Station Road #45\n" +
                "Anita,Sharma,9876543214,38,Female,B+,9876543215,Kanakapura,Market Square #88";
        } else {
            sampleContent = "First Name,Last Name,Phone,Employee ID,Hospital\n" +
                "Dr. Vikram,Singh,9876500001,EMP-101,District Hospital\n" +
                "Priya,Nair,9876500002,HW-202,Community Health Centre";
        }

        const blob = new Blob([sampleContent], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `MedJarvis_${entityType}_Bulk_Sample.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ================================================================
    // CELL VALIDATION LOGIC
    // ================================================================
    const validateCell = (row, key, val) => {
        const v = String(val || "").trim();
        const isEdited = Boolean(row?._edited?.[key]);

        if (key === "firstName" || key === "lastName") {
            if (!v) return { state: "RED", msg: "Required field missing" };
            return { state: isEdited ? "GREEN" : "NORMAL" };
        }

        if (key === "phone") {
            if (!v) return { state: "RED", msg: "Required phone number" };
            if (v.length < 8 || !/^\+?\d+$/.test(v)) return { state: "RED", msg: "Invalid phone number format" };
            return { state: isEdited ? "GREEN" : "NORMAL" };
        }

        if (key === "age") {
            if (!v) return { state: "YELLOW", msg: "Optional age missing (default 30)" };
            if (isNaN(v) || Number(v) <= 0 || Number(v) > 120) return { state: "RED", msg: "Invalid age (1-120)" };
            return { state: isEdited ? "GREEN" : "NORMAL" };
        }

        if (key === "gender") {
            if (!v) return { state: "YELLOW", msg: "Defaulting to Other" };
            if (!["Male", "Female", "Other"].includes(v)) return { state: "RED", msg: "Must be Male, Female, or Other" };
            return { state: isEdited ? "GREEN" : "NORMAL" };
        }

        if (key === "bloodGroup") {
            if (!v) return { state: "YELLOW", msg: "Defaulting to O+" };
            const validGroups = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
            if (!validGroups.includes(v.toUpperCase())) return { state: "RED", msg: "Invalid blood group format" };
            return { state: isEdited ? "GREEN" : "NORMAL" };
        }

        if (key === "emergencyContact") {
            if (!v) return { state: "YELLOW", msg: "Defaulting to patient phone" };
            return { state: isEdited ? "GREEN" : "NORMAL" };
        }

        return { state: isEdited ? "GREEN" : "NORMAL" };
    };

    // Calculate row level status
    const getRowValidation = (row) => {
        const fields = entityType === "Patients"
            ? ["firstName", "lastName", "phone", "age", "gender", "bloodGroup", "emergencyContact", "village"]
            : ["firstName", "lastName", "phone"];

        let hasRed = false;
        let hasYellow = false;

        fields.forEach(f => {
            const v = validateCell(row, f, row[f]);
            if (v.state === "RED") hasRed = true;
            if (v.state === "YELLOW") hasYellow = true;
        });

        if (hasRed) return { status: "ERROR", badge: "🔴 Error", color: "bg-red-50 text-red-700 border-red-200" };
        if (hasYellow) return { status: "WARNING", badge: "🟡 Warning", color: "bg-amber-50 text-amber-800 border-amber-200" };
        return { status: "READY", badge: "🟢 Ready", color: "bg-emerald-50 text-emerald-800 border-emerald-200" };
    };

    // Summary statistics
    const summary = useMemo(() => {
        let ready = 0;
        let warnings = 0;
        let errors = 0;
        let modified = 0;

        parsedRows.forEach(row => {
            const val = getRowValidation(row);
            if (val.status === "ERROR") errors++;
            else if (val.status === "WARNING") warnings++;
            else ready++;

            if (Object.keys(row._edited || {}).length > 0) modified++;
        });

        return { total: parsedRows.length, ready, warnings, errors, modified };
    }, [parsedRows, entityType]);

    // Handle inline cell edit
    const handleCellChange = (rowIndex, colKey, newVal) => {
        setParsedRows(prev => {
            const updated = [...prev];
            const row = { ...updated[rowIndex] };
            row[colKey] = newVal;
            row._edited = { ...row._edited, [colKey]: true };
            updated[rowIndex] = row;
            return updated;
        });
    };

    // Handle per-row action change (Auto / Create / Update / Skip)
    const handleRowActionChange = (rowIndex, action) => {
        setParsedRows(prev => {
            const updated = [...prev];
            updated[rowIndex] = { ...updated[rowIndex], _action: action };
            return updated;
        });
    };

    // Submit import to backend
    const handleConfirmImport = async () => {
        if (summary.errors > 0) {
            setErrorMsg(`Please resolve all ${summary.errors} red blocking errors before importing.`);
            return;
        }

        if (!reviewConfirmed) {
            setErrorMsg("You must check the review confirmation box before importing.");
            return;
        }

        setImporting(true);
        setStage("IMPORTING");
        setErrorMsg("");

        try {
            const res = await api.post("/bulk/import", {
                entityType,
                rows: parsedRows,
                options: { updateExisting: true },
            });

            setImportResult(res.data?.data);
            setStage("RESULTS");
        } catch (err) {
            console.error("Bulk import API error:", err);
            setErrorMsg(err.response?.data?.message || "Failed to execute bulk import.");
            setStage("PREVIEW");
        } finally {
            setImporting(false);
        }
    };

    if (!open) return null;

    if (permittedEntities.length === 0) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 text-center transition-colors duration-200">
                    <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400 mx-auto mb-3" />
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Access Restricted</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                        Your role ({role}) does not have permission to perform bulk operations.
                    </p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="mt-5 w-full bg-slate-900 dark:bg-slate-800 text-white font-bold py-2.5 rounded-xl hover:bg-black dark:hover:bg-slate-700 transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    // ================================================================
    // STAGE 1: FILE UPLOAD MODAL
    // ================================================================
    if (stage === "UPLOAD") {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
                <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-[#E8E0D5] relative animate-in fade-in zoom-in-95">
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-6 right-6 text-gray-400 hover:text-gray-700 transition p-1 rounded-lg hover:bg-gray-100"
                    >
                        <X size={20} />
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-[#D8F3DC] text-[#2D6A4F] flex items-center justify-center font-bold">
                            <Upload size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-[#1A1A1A]">Bulk Import</h2>
                            <p className="text-sm text-gray-600 mt-0.5">Upload a CSV or Excel file to import multiple records</p>
                        </div>
                    </div>

                    {/* Entity selector */}
                    <div className="mt-6">
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                            Select Entity Type to Import
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {permittedEntities.map(ent => (
                                <button
                                    key={ent}
                                    type="button"
                                    onClick={() => setEntityType(ent)}
                                    className={`py-2.5 px-3 rounded-xl text-sm font-bold border transition text-center ${entityType === ent
                                            ? "bg-[#2D6A4F] text-white border-[#2D6A4F]"
                                            : "bg-[#FAF7F2] text-gray-700 border-[#E8E0D5] hover:border-[#2D6A4F]"
                                        }`}
                                >
                                    {ent}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Drag & drop box */}
                    <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                            e.preventDefault();
                            if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
                        }}
                        className="mt-6 border-2 border-dashed border-[#2D6A4F]/40 bg-[#FAF7F2] rounded-2xl p-8 text-center hover:bg-[#F2F7F4] transition cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,.txt,.xlsx,.xls,.pdf"
                            className="hidden"
                            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                        />
                        <FileSpreadsheet className="w-14 h-14 text-[#2D6A4F] mx-auto mb-3 opacity-90" />
                        <p className="text-base font-bold text-gray-900">Drag & drop your file here</p>
                        <p className="text-xs text-gray-500 mt-1">or <span className="text-[#2D6A4F] underline font-semibold">Browse Files</span> from your device</p>
                        <p className="text-[11px] text-gray-400 mt-3">Supported formats: .csv, .xlsx, .xls, .pdf (structured table)</p>
                    </div>

                    {errorMsg && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold flex items-center gap-2">
                            <AlertCircle size={16} className="shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* Bottom actions */}
                    <div className="mt-6 pt-4 border-t border-[#E8E0D5] flex justify-between items-center">
                        <button
                            type="button"
                            onClick={downloadSampleCSV}
                            className="text-xs font-bold text-[#2D6A4F] hover:underline flex items-center gap-1.5"
                        >
                            <Download size={14} />
                            Download Sample Template
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-bold hover:bg-gray-100 transition"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ================================================================
    // STAGE 2: LARGE PREVIEW MODAL (80-90% Fixed Layout, Scrollable Table)
    // ================================================================
    if (stage === "PREVIEW") {
        const columns = entityType === "Patients"
            ? [
                { key: "firstName", label: "First Name *" },
                { key: "lastName", label: "Last Name *" },
                { key: "phone", label: "Phone *" },
                { key: "age", label: "Age" },
                { key: "gender", label: "Gender" },
                { key: "bloodGroup", label: "Blood Group" },
                { key: "emergencyContact", label: "Emergency Contact" },
                { key: "village", label: "Village" },
                { key: "address", label: "Address" },
            ]
            : [
                { key: "firstName", label: "First Name *" },
                { key: "lastName", label: "Last Name *" },
                { key: "phone", label: "Phone *" },
                { key: "employeeId", label: "Employee ID" },
                { key: "hospital", label: "Hospital" },
            ];

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-6">
                {/* 80-90% MODAL CONTAINER */}
                <div className="bg-[#FAF7F2] rounded-3xl w-full max-w-7xl h-[90vh] flex flex-col shadow-2xl border border-[#E8E0D5] overflow-hidden">

                    {/* =================================================== */}
                    {/* FIXED HEADER */}
                    {/* =================================================== */}
                    <div className="bg-white px-6 py-4 border-b border-[#E8E0D5] shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3">
                                <span className="bg-[#D8F3DC] text-[#2D6A4F] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                                    {entityType} Import Review
                                </span>
                                <span className="text-xs text-gray-500 font-mono">
                                    File: {fileInfo?.name} ({fileInfo?.rowCount} rows)
                                </span>
                            </div>
                            <h2 className="text-xl font-extrabold text-[#1A1A1A] mt-1">
                                Review & Edit Import Data
                            </h2>
                        </div>

                        {/* STATS BADGES */}
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="bg-gray-100 text-gray-800 px-3 py-1.5 rounded-xl text-xs font-bold border">
                                Total: <span className="text-sm font-black">{summary.total}</span>
                            </div>
                            <div className="bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-xl text-xs font-bold border border-emerald-200">
                                🟢 Ready: <span className="text-sm font-black">{summary.ready}</span>
                            </div>
                            <div className="bg-amber-50 text-amber-800 px-3 py-1.5 rounded-xl text-xs font-bold border border-amber-200">
                                🟡 Warnings: <span className="text-sm font-black">{summary.warnings}</span>
                            </div>
                            <div className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${summary.errors > 0 ? "bg-red-100 text-red-900 border-red-300 animate-pulse" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
                                🔴 Errors: <span className="text-sm font-black">{summary.errors}</span>
                            </div>
                            {summary.modified > 0 && (
                                <div className="bg-blue-50 text-blue-800 px-3 py-1.5 rounded-xl text-xs font-bold border border-blue-200">
                                    ✏️ Edited: <span className="text-sm font-black">{summary.modified}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* =================================================== */}
                    {/* SCROLLABLE EXCEL-LIKE TABLE AREA */}
                    {/* =================================================== */}
                    <div className="flex-1 overflow-auto p-4 bg-white">
                        <table className="w-full border-collapse text-left text-xs font-medium">
                            {/* STICKY HEADER */}
                            <thead className="sticky top-0 bg-[#2D6A4F] text-white z-10 shadow-sm">
                                <tr>
                                    <th className="py-3 px-3 w-12 text-center border-r border-[#1B4332]">#</th>
                                    <th className="py-3 px-3 w-28 text-center border-r border-[#1B4332]">Status</th>
                                    <th className="py-3 px-3 w-28 text-center border-r border-[#1B4332]">Action</th>
                                    {columns.map(col => (
                                        <th key={col.key} className="py-3 px-4 min-w-[130px] border-r border-[#1B4332] font-bold">
                                            {col.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {parsedRows.map((row, idx) => {
                                    const validation = getRowValidation(row);

                                    return (
                                        <tr key={row._id || idx} className="hover:bg-gray-50/80 transition">
                                            {/* Row # */}
                                            <td className="py-2.5 px-3 text-center text-gray-500 font-mono font-bold bg-gray-50/50 border-r">
                                                {idx + 1}
                                            </td>

                                            {/* Row Status Badge */}
                                            <td className="py-2.5 px-2 text-center border-r">
                                                <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${validation.color}`}>
                                                    {validation.badge}
                                                </span>
                                            </td>

                                            {/* Action preference selector */}
                                            <td className="py-2.5 px-2 text-center border-r">
                                                <select
                                                    value={row._action}
                                                    onChange={(e) => handleRowActionChange(idx, e.target.value)}
                                                    className="bg-white border border-gray-300 rounded-lg px-2 py-1 text-[11px] font-bold text-gray-800 focus:ring-1 focus:ring-[#2D6A4F]"
                                                >
                                                    <option value="AUTO">Auto</option>
                                                    <option value="CREATE">Create</option>
                                                    <option value="UPDATE">Update</option>
                                                    <option value="SKIP">Skip</option>
                                                </select>
                                            </td>

                                            {/* Editable Data Cells */}
                                            {columns.map(col => {
                                                const val = row[col.key] || "";
                                                const cellVal = validateCell(row, col.key, val);
                                                const isEditing = editingCell?.rowIndex === idx && editingCell?.colKey === col.key;

                                                // Dynamic Cell Background Styles
                                                let cellStyle = "bg-white text-gray-900";
                                                if (cellVal.state === "RED") {
                                                    cellStyle = "bg-red-100 text-red-950 font-bold border-2 border-red-400";
                                                } else if (cellVal.state === "YELLOW") {
                                                    cellStyle = "bg-amber-50 text-amber-950 border border-amber-300";
                                                } else if (cellVal.state === "GREEN") {
                                                    cellStyle = "bg-emerald-100 text-emerald-950 font-bold border border-emerald-400";
                                                }

                                                return (
                                                    <td
                                                        key={col.key}
                                                        onClick={() => setEditingCell({ rowIndex: idx, colKey: col.key })}
                                                        title={cellVal.msg || "Click to edit value"}
                                                        className={`py-2 px-3 border-r border-b cursor-pointer transition-all min-w-[130px] ${cellStyle}`}
                                                    >
                                                        {isEditing ? (
                                                            <input
                                                                type="text"
                                                                autoFocus
                                                                value={val}
                                                                onChange={(e) => handleCellChange(idx, col.key, e.target.value)}
                                                                onBlur={() => setEditingCell(null)}
                                                                onKeyDown={(e) => e.key === "Enter" && setEditingCell(null)}
                                                                className="w-full bg-white text-gray-900 px-2 py-1 rounded border-2 border-[#2D6A4F] outline-none font-bold text-xs"
                                                            />
                                                        ) : (
                                                            <div className="flex items-center justify-between gap-1">
                                                                <span className="truncate">{val || <em className="text-gray-400 font-normal">empty</em>}</span>
                                                                {cellVal.state === "RED" && (
                                                                    <AlertTriangle size={14} className="text-red-700 shrink-0" />
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* =================================================== */}
                    {/* FIXED FOOTER (NEVER SCROLLS AWAY WITH TABLE) */}
                    {/* =================================================== */}
                    <div className="bg-white px-6 py-4 border-t border-[#E8E0D5] shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        {/* Mandatory Review Checkbox */}
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={reviewConfirmed}
                                onChange={(e) => setReviewConfirmed(e.target.checked)}
                                className="w-5 h-5 rounded text-[#2D6A4F] focus:ring-[#2D6A4F] border-gray-300 cursor-pointer"
                            />
                            <span className="text-xs sm:text-sm font-bold text-gray-900">
                                I have reviewed the imported data and confirm that it is ready to be imported.
                            </span>
                        </label>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={handleReset}
                                className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-bold hover:bg-gray-100 transition"
                            >
                                Cancel / Re-upload
                            </button>

                            <button
                                type="button"
                                onClick={handleConfirmImport}
                                disabled={summary.errors > 0 || !reviewConfirmed || importing}
                                className={`px-6 py-2.5 rounded-xl text-white text-sm font-extrabold flex items-center gap-2 transition ${summary.errors > 0 || !reviewConfirmed || importing
                                        ? "bg-gray-400 cursor-not-allowed opacity-60"
                                        : "bg-[#2D6A4F] hover:bg-[#1B4332] shadow-md hover:shadow-lg"
                                    }`}
                            >
                                <Check size={18} />
                                {importing ? "Processing..." : `Import ${summary.total} Records`}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ================================================================
    // STAGE 3: IMPORTING PROGRESS
    // ================================================================
    if (stage === "IMPORTING") {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
                <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl text-center border border-[#E8E0D5]">
                    <div className="w-16 h-16 rounded-full bg-[#D8F3DC] text-[#2D6A4F] mx-auto flex items-center justify-center mb-4">
                        <RotateCcw className="w-8 h-8 animate-spin" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">Importing Records</h3>
                    <p className="text-sm text-gray-600 mt-2">
                        Writing records to database with duplicate checks and audit logging...
                    </p>
                    <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden mt-6">
                        <div className="bg-[#2D6A4F] h-full w-3/4 animate-pulse rounded-full" />
                    </div>
                </div>
            </div>
        );
    }

    // ================================================================
    // STAGE 4: RESULTS SUMMARY MODAL
    // ================================================================
    if (stage === "RESULTS" && importResult) {
        const { summary: sum, rowResults } = importResult;

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
                <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-[#E8E0D5]">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                            <CheckCircle2 size={26} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">Bulk Import Complete</h2>
                            <p className="text-xs font-mono text-gray-500 mt-0.5">Batch ID: {importResult.bulkImportId}</p>
                        </div>
                    </div>

                    {/* STATS GRID */}
                    <div className="grid grid-cols-4 gap-3 mt-6">
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center">
                            <p className="text-2xl font-extrabold text-emerald-800">{sum?.created || 0}</p>
                            <p className="text-[11px] font-bold text-emerald-900 uppercase">Created</p>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-center">
                            <p className="text-2xl font-extrabold text-blue-800">{sum?.updated || 0}</p>
                            <p className="text-[11px] font-bold text-blue-900 uppercase">Updated</p>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
                            <p className="text-2xl font-extrabold text-amber-800">{sum?.skipped || 0}</p>
                            <p className="text-[11px] font-bold text-amber-900 uppercase">Skipped</p>
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-center">
                            <p className="text-2xl font-extrabold text-red-800">{sum?.failed || 0}</p>
                            <p className="text-[11px] font-bold text-red-900 uppercase">Failed</p>
                        </div>
                    </div>

                    {/* ROW DETAILS LIST */}
                    <div className="mt-6 border border-gray-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
                        <div className="bg-gray-100 px-4 py-2 border-b text-xs font-bold text-gray-700">
                            Detailed Execution Results ({rowResults?.length || 0} items)
                        </div>
                        <div className="divide-y divide-gray-100 text-xs">
                            {rowResults?.map((res, i) => (
                                <div key={i} className="px-4 py-2 flex items-center justify-between gap-2">
                                    <span className="font-mono text-gray-500">Row #{res.rowNumber}</span>
                                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${res.status === 'CREATED' ? 'bg-emerald-100 text-emerald-800' :
                                            res.status === 'UPDATED' ? 'bg-blue-100 text-blue-800' :
                                                res.status === 'SKIPPED' ? 'bg-amber-100 text-amber-800' :
                                                    'bg-red-100 text-red-800'
                                        }`}>
                                        {res.status}
                                    </span>
                                    <span className="truncate flex-1 text-gray-700 text-right">{res.message}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CLOSE BUTTON */}
                    <div className="mt-6 text-right">
                        <button
                            type="button"
                            onClick={() => {
                                onClose();
                                if (onSuccess) onSuccess();
                            }}
                            className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white px-6 py-2.5 rounded-xl font-bold transition text-sm"
                        >
                            Done & Refresh
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}
