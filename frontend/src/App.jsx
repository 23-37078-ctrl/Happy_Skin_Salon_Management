import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import AppRoutes from "./routes/AppRoutes";
import { PayPalProvider } from "@paypal/react-paypal-js/sdk-v6";

export default function App() {
  return (
    <PayPalProvider clientId={import.meta.env.VITE_PAYPAL_CLIENT_ID} environment="sandbox" components={["paypal-payments"]} pageType="checkout">
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <AppRoutes />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
    </PayPalProvider>
  );
}
