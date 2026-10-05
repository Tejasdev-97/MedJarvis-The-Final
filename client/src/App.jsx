import AppRouter from "./routes/AppRouter";
import { ThemeProvider } from "./context/ThemeContext";
import { LanguageProvider } from "./context/LanguageContext";

export default function App() {
    return (
        <ThemeProvider>
            <LanguageProvider>
                <AppRouter />
            </LanguageProvider>
        </ThemeProvider>
    );
}