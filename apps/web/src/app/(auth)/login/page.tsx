import { AuthForm } from "@/components/AuthForm";
import { loginAction } from "@/app/actions/auth";

export default async function Login({ searchParams }: { searchParams: Promise<{ reset?: string; expired?: string; next?: string }> }) {
  const q = await searchParams;
  const notice = q.reset ? "Password changed. Sign in with your new password." : q.expired ? "Your session ended because the password was changed. Please sign in again." : undefined;
  return <AuthForm mode="login" action={loginAction} notice={notice} next={q.next} />;
}
