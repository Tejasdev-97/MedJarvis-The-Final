import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import Card from "../components/common/Card";
import Logo from "../components/common/Logo";
import ProfileCard from "../components/auth/ProfileCard";
import {
    selectProfile,
    saveToken,
} from "../services/authService";

export default function ProfileSelectionPage() {

    const navigate = useNavigate();

    const profiles = JSON.parse(

        localStorage.getItem("profiles") || "[]"

    );

    useEffect(() => {

        if (profiles.length === 0) {

            navigate("/login");

        }

    }, []);

    const handleSelect = async (profile) => {

    try {

        const res = await selectProfile(profile._id);

        saveToken(res.token);

        localStorage.setItem(
            "profile",
            JSON.stringify(res.profile)
        );

        localStorage.removeItem("profiles");

        navigate("/dashboard");

    } catch (err) {

        alert(
            err.response?.data?.message ||
            "Unable to select profile."
        );

    }

};

    return (

        <div className="min-h-screen bg-[#FAF7F2] dark:bg-slate-950 flex justify-center items-center px-4 transition-colors duration-200">

            <Card className="max-w-xl w-full">

                <div className="space-y-8">

                    <Logo center />

                    <div>

                        <h2 className="text-3xl text-center font-serif text-slate-900 dark:text-slate-100 font-bold">

                            Select Profile

                        </h2>

                        <p className="text-center text-slate-600 dark:text-slate-400 mt-2">

                            Choose the profile you want to continue with.

                        </p>

                    </div>

                    <div className="space-y-4">

                        {

                            profiles.map(profile => (

                                <ProfileCard

                                    key={profile._id}

                                    profile={profile}

                                    onSelect={handleSelect}

                                />

                            ))

                        }

                    </div>

                </div>

            </Card>

        </div>

    );

}