import { useState } from "react";
import { CheckCircle, UserPlus, Loader2 } from "lucide-react";
import api from "../services/api";
import FormInput from "../components/forms/FormInput";

const initialForm = {
    phone: "",
    firstName: "",
    lastName: "",
    age: "",
    gender: "",
    bloodGroup: "",
    village: "",
};

export default function RegisterPatientPage() {
    const [form, setForm] = useState(initialForm);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    function updateField(field, value) {
        setForm((previous) => ({
            ...previous,
            [field]: value,
        }));
    }

    async function registerPatient(e) {
        e.preventDefault();

        setError("");
        setSuccess("");

        if (!form.firstName.trim()) {
            setError("First name is required.");
            return;
        }

        if (!form.phone.trim()) {
            setError("Phone number is required.");
            return;
        }

        try {
            setLoading(true);

            const res = await api.post(
                "/patients",
                {
                    ...form,
                    firstName: form.firstName.trim(),
                    lastName: form.lastName.trim(),
                    phone: form.phone.trim(),
                    village: form.village.trim(),
                }
            );

            setSuccess(
                res.data?.message ||
                "Patient registered successfully."
            );

            setForm(initialForm);
        } catch (err) {
            console.error(
                "Register patient error:",
                err
            );

            setError(
                err.response?.data?.message ||
                "Unable to register patient."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="max-w-4xl mx-auto">

            <div className="mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-[#D8F3DC] dark:bg-emerald-950 flex items-center justify-center">
                        <UserPlus
                            size={22}
                            className="text-[#2D6A4F] dark:text-emerald-400"
                        />
                    </div>

                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                            Register Patient
                        </h1>

                        <p className="text-[#4A4A4A] dark:text-slate-400 mt-1">
                            Create a new MedJarvis patient profile.
                        </p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="mb-5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-xl px-4 py-3">
                    {error}
                </div>
            )}

            {success && (
                <div className="mb-5 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-900 text-green-700 dark:text-green-300 rounded-xl px-4 py-3 flex items-start gap-3">
                    <CheckCircle
                        size={20}
                        className="mt-0.5 shrink-0"
                    />
                    <span>{success}</span>
                </div>
            )}

            <form
                onSubmit={registerPatient}
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-[#E8E0D5] dark:border-slate-800 p-6 md:p-8 text-slate-900 dark:text-slate-100"
            >

                <div className="grid md:grid-cols-2 gap-5">

                    <FormInput
                        label="First Name"
                        value={form.firstName}
                        onChange={(e) =>
                            updateField(
                                "firstName",
                                e.target.value
                            )
                        }
                    />

                    <FormInput
                        label="Last Name"
                        value={form.lastName}
                        onChange={(e) =>
                            updateField(
                                "lastName",
                                e.target.value
                            )
                        }
                    />

                    <FormInput
                        label="Phone Number"
                        value={form.phone}
                        onChange={(e) =>
                            updateField(
                                "phone",
                                e.target.value
                            )
                        }
                    />

                    <FormInput
                        label="Age"
                        value={form.age}
                        onChange={(e) =>
                            updateField(
                                "age",
                                e.target.value
                            )
                        }
                    />

                    <FormInput
                        label="Gender"
                        value={form.gender}
                        onChange={(e) =>
                            updateField(
                                "gender",
                                e.target.value
                            )
                        }
                    />

                    <FormInput
                        label="Blood Group"
                        value={form.bloodGroup}
                        onChange={(e) =>
                            updateField(
                                "bloodGroup",
                                e.target.value
                            )
                        }
                    />

                    <FormInput
                        label="Village"
                        value={form.village}
                        onChange={(e) =>
                            updateField(
                                "village",
                                e.target.value
                            )
                        }
                    />

                </div>

                <div className="mt-8 flex justify-end">

                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-[#2D6A4F] hover:bg-[#1B4332] dark:bg-emerald-600 dark:hover:bg-emerald-500 font-bold text-white px-7 py-3 rounded-xl flex items-center gap-2 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <Loader2
                                    size={19}
                                    className="animate-spin"
                                />
                                Registering...
                            </>
                        ) : (
                            <>
                                <UserPlus size={19} />
                                Register Patient
                            </>
                        )}
                    </button>

                </div>

            </form>

        </div>
    );
}