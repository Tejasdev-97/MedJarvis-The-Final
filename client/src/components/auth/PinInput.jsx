import { useEffect, useRef } from "react";

export default function PinInput({

    value,
    onChange

}) {

    const refs = useRef([]);

    const values = value.split("");

    useEffect(() => {

        if (refs.current[0] && value.length === 0) {
            refs.current[0].focus();
        }

    }, []);

    const handleChange = (index, e) => {

        const digit = e.target.value.replace(/\D/g, "");

        const pin = [...values];

        pin[index] = digit;

        const newPin = pin.join("").substring(0, 4);

        onChange(newPin);

        if (digit && index < 3) {
            refs.current[index + 1].focus();
        }

    };

    const handleKeyDown = (index, e) => {

        if (
            e.key === "Backspace" &&
            !values[index] &&
            index > 0
        ) {
            refs.current[index - 1].focus();
        }

    };

    return (

        <div className="flex justify-between gap-3">

            {[0,1,2,3].map((i)=>(

                <input

                    key={i}

                    ref={(el)=>refs.current[i]=el}

                    type="password"

                    inputMode="numeric"

                    maxLength={1}

                    value={values[i] || ""}

                    onChange={(e)=>handleChange(i,e)}

                    onKeyDown={(e)=>handleKeyDown(i,e)}

                    className="
                        w-14
                        h-14
                        rounded-xl
                        border
                        border-[#E8E0D5]
                        dark:border-slate-700
                        bg-white
                        dark:bg-slate-800
                        text-slate-900
                        dark:text-slate-100
                        text-center
                        text-xl
                        font-bold
                        focus:ring-2
                        focus:ring-[#2D6A4F]
                        outline-none
                    "

                />

            ))}

        </div>

    );

}