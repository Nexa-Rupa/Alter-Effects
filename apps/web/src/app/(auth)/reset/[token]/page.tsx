import type { Metadata } from "next";
import { ResetForm } from "@/components/PasswordForms";

// The site-wide Referrer-Policy (strict-origin-when-cross-origin) already keeps the token out of cross-site requests.
export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default async function Reset({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ResetForm token={token} />;
}
