import { useState } from "react";
import api from "../../services/api";

export default function CreateAccountModal({
    open,
    onClose,
}) {

    const [form, setForm] = useState({
        phone: "",
        pin: "",
    });

    if (!open) return null;

    async function submit(e) {

        e.preventDefault();

        try {

            await api.post("/auth/register", form);

            alert(
    `Account Created\n\nPhone : ${form.phone}`
);

            setForm({
                phone: "",
                pin: "",
            });

            onClose();

        } catch (err) {

            alert(err.response?.data?.message || "Error");

        }

    }

    return (

        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">

            <form
                onSubmit={submit}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl transition-colors duration-200"
            >

                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">

                    Create New Account

                </h2>

                <input
                    className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl p-3 w-full focus:ring-2 focus:ring-[#2D6A4F] outline-none"
                    placeholder="Phone Number"
                    value={form.phone}
                    onChange={(e)=>
                        setForm({
                            ...form,
                            phone:e.target.value
                        })
                    }
                />

                <input
                    type="password"
                    className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl p-3 w-full focus:ring-2 focus:ring-[#2D6A4F] outline-none"
                    placeholder="PIN"
                    value={form.pin}
                    onChange={(e)=>
                        setForm({
                            ...form,
                            pin:e.target.value
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