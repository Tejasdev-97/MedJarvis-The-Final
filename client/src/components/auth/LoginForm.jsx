import { useState } from "react";
import Input from "../common/Input";
import Button from "../common/Button";
import PinInput from "./PinInput";
import { useLanguage } from "../../context/LanguageContext";

export default function LoginForm({
    onSubmit,
    loading = false,
    error = ""
}) {
    const { t } = useLanguage();
    const [phone, setPhone] = useState("");
    const [pin, setPin] = useState("");

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log("FORM SUBMITTED");
        onSubmit({
            phone,
            pin
        });
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-6"
        >
            <Input
                label={t("Phone Number")}
                placeholder="9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
            />

            <div>
                <label className="text-sm font-medium opacity-80 mb-2 block">
                    {t("4 Digit PIN")}
                </label>
                <PinInput
                    value={pin}
                    onChange={setPin}
                />
            </div>

            {error && (
                <p className="text-red-500 text-sm">
                    {error}
                </p>
            )}

            <Button
                type="submit"
                full
                loading={loading}
            >
                {t("Login")}
            </Button>
        </form>
    );
}