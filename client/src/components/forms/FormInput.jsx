export default function FormInput({

    label,
    ...props

}) {

    return (

        <div>

            <label className="block mb-2 font-medium text-slate-700 dark:text-slate-200">

                {label}

            </label>

            <input
                {...props}
                className="border border-[#E8E0D5] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl w-full p-3 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
            />

        </div>

    );

}