import { useEffect, useState } from "react";
import {
    Activity,
    Pill,
    AlertTriangle,
    Stethoscope,
    Hospital,
    CalendarDays,
} from "lucide-react";
import api from "../../services/api";

export default function PatientTimeline({ patientId }) {

    const [timeline, setTimeline] = useState([]);

    useEffect(() => {

        loadTimeline();

    }, [patientId]);

    async function loadTimeline() {

        try {

            const res = await api.get(`/timeline/${patientId}`);

            setTimeline(res.data.data);

        } catch {

            setTimeline([]);

        }

    }

    function getEvent(eventType) {

        switch (eventType) {

            case "Prescription":

                return {
                    icon: Pill,
                    color: "bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 dark:border dark:border-blue-800",
                };

            case "Diagnosis":

                return {
                    icon: Stethoscope,
                    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border dark:border-emerald-800",
                };

            case "Emergency":

                return {
                    icon: AlertTriangle,
                    color: "bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300 dark:border dark:border-red-800",
                };

            case "Admission":

                return {
                    icon: Hospital,
                    color: "bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 dark:border dark:border-purple-800",
                };

            default:

                return {
                    icon: Activity,
                    color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:border dark:border-slate-700",
                };

        }

    }

    return (

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl shadow-sm p-6 mt-8 transition-colors duration-200">

            <div className="flex justify-between items-center mb-6">

                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">

                    Medical Timeline

                </h2>

                <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">

                    {timeline.length} Events

                </span>

            </div>

            {

                timeline.length === 0 ?

                (

                    <div className="text-center py-10">

                        <Activity
                            size={45}
                            className="mx-auto text-slate-400 dark:text-slate-600"
                        />

                        <p className="mt-4 text-slate-500 dark:text-slate-400">

                            No medical events recorded yet.

                        </p>

                    </div>

                )

                :

                (

                    <div className="space-y-6">

                        {

                            timeline.map((item) => {

                                const event = getEvent(item.eventType);

                                const Icon = event.icon;

                                return (

                                    <div
                                        key={item._id}
                                        className="relative border-l-4 border-[#2D6A4F] dark:border-emerald-500 pl-6"
                                    >

                                        <div
                                            className={`absolute -left-5 top-0 rounded-full p-2 ${event.color}`}
                                        >

                                            <Icon size={18} />

                                        </div>

                                        <div className="flex justify-between items-start">

                                            <div>

                                                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">

                                                    {item.title}

                                                </h3>

                                                <p className="text-slate-600 dark:text-slate-300 mt-2">

                                                    {item.description}

                                                </p>

                                            </div>

                                            <span
                                                className={`text-xs px-3 py-1 rounded-full ${event.color}`}
                                            >

                                                {item.eventType}

                                            </span>

                                        </div>

                                        <div className="flex items-center gap-2 mt-4 text-sm text-slate-400 dark:text-slate-500">

                                            <CalendarDays size={15} />

                                            {new Date(
                                                item.createdAt
                                            ).toLocaleString()}

                                        </div>

                                    </div>

                                );

                            })

                        }

                    </div>

                )

            }

        </div>

    );

}