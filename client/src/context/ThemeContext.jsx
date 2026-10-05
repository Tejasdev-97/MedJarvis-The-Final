import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    const [theme, setThemeState] = useState(() => {
        try {
            return localStorage.getItem("medjarvis_theme") || "light";
        } catch {
            return "light";
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem("medjarvis_theme", theme);
        } catch (e) {
            console.warn("Could not save theme preference:", e);
        }

        const root = document.documentElement;
        if (theme === "dark") {
            root.classList.add("dark");
            document.body.classList.add("dark");
        } else {
            root.classList.remove("dark");
            document.body.classList.remove("dark");
        }
    }, [theme]);

    const toggleTheme = () => {
        setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
    };

    const setTheme = (mode) => {
        if (mode === "dark" || mode === "light") {
            setThemeState(mode);
        }
    };

    return (
        <ThemeContext.Provider
            value={{
                theme,
                isDark: theme === "dark",
                toggleTheme,
                setTheme,
            }}
        >
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
}
