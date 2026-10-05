import { useState } from "react";
import api from "../../services/api";

export default function CreateProfileModal({
    open,
    onClose,
    onSuccess,
    profileRole,
}) {
    const [form, setForm] = useState({
        phone: "",
        displayName: "",
        role: "",
        employeeId: "",
        hospital: "",
    });

    if (!open) return null;

    async function submit(e) {
        e.preventDefault();

        try {
            await api.post("/auth/create-profile", form);

            alert("Profile created successfully.");

            setForm({
                phone: "",
                displayName: "",
                role: "",
                employeeId: "",
                hospital: "",
            });

            onSuccess();
            onClose();
        } catch (err) {
            alert(err.response?.data?.message || "Error");
        }
    }

    const creatorRole = profileRole || "Hospital Manager";

    const roleOptions =
        creatorRole === "Super Admin"
            ? [{ value: "Hospital Manager", label: "Hospital Manager" }]
            : [
                  { value: "Doctor", label: "Doctor" },
                  { value: "Health Worker", label: "Health Worker" },
                  { value: "Ambulance Staff", label: "Ambulance Staff" },
                  { value: "Hospital Staff", label: "Hospital Staff" },
              ];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <form
                onSubmit={submit}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-xl transition-colors duration-200"
            >
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    Create Profile
                </h2>

                <input
                    placeholder="Phone Number (e.g. 9876543210)"
                    className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl w-full p-3 focus:ring-2 focus:ring-[#2D6A4F] outline-none"
                    value={form.phone}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            phone: e.target.value,
                        })
                    }
                    required
                />

                <input
                    placeholder="Display Name"
                    className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl w-full p-3 focus:ring-2 focus:ring-[#2D6A4F] outline-none"
                    value={form.displayName}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            displayName: e.target.value,
                        })
                    }
                    required
                />

                <select
                    className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl w-full p-3 focus:ring-2 focus:ring-[#2D6A4F] outline-none"
                    value={form.role}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            role: e.target.value,
                        })
                    }
                    required
                >
                    <option value="" className="bg-white dark:bg-slate-800">
                        Select Role
                    </option>
                    {roleOptions.map((opt) => (
                        <option
                            key={opt.value}
                            value={opt.value}
                            className="bg-white dark:bg-slate-800"
                        >
                            {opt.label}
                        </option>
                    ))}
                </select>

                <input
                    placeholder="Employee ID"
                    className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl w-full p-3 focus:ring-2 focus:ring-[#2D6A4F] outline-none"
                    value={form.employeeId}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            employeeId: e.target.value,
                        })
                    }
                />

                <input
                    placeholder="Hospital / Facility Name"
                    className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl w-full p-3 focus:ring-2 focus:ring-[#2D6A4F] outline-none"
                    value={form.hospital}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            hospital: e.target.value,
                        })
                    }
                />

                <div className="flex justify-end gap-3 pt-2">

                    <button
                        type="button"
                        onClick={onClose}
                        className="border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl px-5 py-2 transition"
                    >
                        Cancel
                    </button>

                    <button
                        className="bg-[#2D6A4F] hover:bg-[#22533e] text-white rounded-xl px-5 py-2 font-medium shadow-sm transition"
                    >
                        Create
                    </button>

                </div>

            </form>

        </div>

    );

}