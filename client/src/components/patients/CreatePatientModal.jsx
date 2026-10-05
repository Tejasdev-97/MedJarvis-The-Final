import { useState } from "react";
import api from "../../services/api";

export default function CreatePatientModal({

    open,
    onClose,
    onSuccess,

}) {

    const [form, setForm] = useState({

        firstName: "",
        lastName: "",
        dateOfBirth: "",
        gender: "Male",
        bloodGroup: "B+",
        phone: "",
        emergencyContact: "",
        village: "",
        address: "",
        district: "",
        state: "Karnataka",
        pincode: "",

    });

    const change = (e) => {

        setForm({

            ...form,

            [e.target.name]: e.target.value,

        });

    };

    async function savePatient() {

    try {

        const today = new Date();

        const dob = new Date(form.dateOfBirth);

        let age =
            today.getFullYear() -
            dob.getFullYear();

        const month =
            today.getMonth() -
            dob.getMonth();

        if (
            month < 0 ||
            (month === 0 &&
                today.getDate() < dob.getDate())
        ) {
            age--;
        }

        await api.post("/patients", {
            ...form,
            age,
        });

        alert("Patient Created Successfully");

        onSuccess();

        onClose();

    } catch (err) {

        alert(
            err.response?.data?.message ||
            "Unable to create patient."
        );

    }

}

    if (!open) return null;

    return (

        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl p-6 w-full max-w-2xl shadow-xl transition-colors duration-200">

                <h2 className="text-2xl font-bold mb-5 text-slate-900 dark:text-slate-100">

                    Register Patient

                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    <input
                        name="firstName"
                        placeholder="First Name"
                        onChange={change}
                        className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg p-3 focus:ring-2 focus:ring-[#2D6A4F] outline-none"
                    />

                    <input
                        name="lastName"
                        placeholder="Last Name"
                        onChange={change}
                        className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg p-3 focus:ring-2 focus:ring-[#2D6A4F] outline-none"
                    />

                    <input
                        name="dateOfBirth"
                        type="date"
                        onChange={change}
                        className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg p-3 focus:ring-2 focus:ring-[#2D6A4F] outline-none"
                    />

                    <select
                        name="gender"
                        value={form.gender}
                        onChange={change}
                        className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg p-3 focus:ring-2 focus:ring-[#2D6A4F] outline-none"
                    >
                        <option value="Male" className="bg-white dark:bg-slate-800">Male</option>
                        <option value="Female" className="bg-white dark:bg-slate-800">Female</option>
                        <option value="Other" className="bg-white dark:bg-slate-800">Other</option>
                    </select>

                    <select
                        name="bloodGroup"
                        value={form.bloodGroup}
                        onChange={change}
                        className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg p-3 focus:ring-2 focus:ring-[#2D6A4F] outline-none"
                    >
                        <option value="A+" className="bg-white dark:bg-slate-800">A+</option>
                        <option value="A-" className="bg-white dark:bg-slate-800">A-</option>
                        <option value="B+" className="bg-white dark:bg-slate-800">B+</option>
                        <option value="B-" className="bg-white dark:bg-slate-800">B-</option>
                        <option value="AB+" className="bg-white dark:bg-slate-800">AB+</option>
                        <option value="AB-" className="bg-white dark:bg-slate-800">AB-</option>
                        <option value="O+" className="bg-white dark:bg-slate-800">O+</option>
                        <option value="O-" className="bg-white dark:bg-slate-800">O-</option>
                    </select>

                    <input
                        name="phone"
                        placeholder="Phone"
                        onChange={change}
                        className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg p-3 focus:ring-2 focus:ring-[#2D6A4F] outline-none"
                    />

                    <input
                        name="emergencyContact"
                        placeholder="Emergency Contact"
                        onChange={change}
                        className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg p-3 focus:ring-2 focus:ring-[#2D6A4F] outline-none"
                    />

                    <input
                        name="village"
                        placeholder="Village"
                        onChange={change}
                        className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg p-3 focus:ring-2 focus:ring-[#2D6A4F] outline-none"
                    />

                    <input
                        name="district"
                        placeholder="District"
                        onChange={change}
                        className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg p-3 focus:ring-2 focus:ring-[#2D6A4F] outline-none"
                    />

                    <input
                        name="pincode"
                        placeholder="Pincode"
                        onChange={change}
                        className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg p-3 focus:ring-2 focus:ring-[#2D6A4F] outline-none"
                    />

                </div>

                <textarea
                    name="address"
                    placeholder="Address"
                    rows="3"
                    onChange={change}
                    className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg p-3 mt-4 w-full focus:ring-2 focus:ring-[#2D6A4F] outline-none"
                />

                <div className="flex justify-end gap-3 mt-6">

                    <button

                        onClick={onClose}

                        className="px-5 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"

                    >

                        Cancel

                    </button>

                    <button

                        onClick={savePatient}

                        className="px-6 py-2 bg-[#2D6A4F] hover:bg-[#22533e] text-white rounded-lg transition font-medium shadow-sm"

                    >

                        Save Patient

                    </button>

                </div>

            </div>

        </div>

    );

}