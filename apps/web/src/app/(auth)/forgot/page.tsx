import type { Metadata } from "next";
import { ForgotForm } from "@/components/PasswordForms";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default function Forgot() {
  return <ForgotForm />;
}
