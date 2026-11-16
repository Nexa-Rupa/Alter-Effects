import { AuthForm } from "@/components/AuthForm";
import { signupAction } from "@/app/actions/auth";

export default async function Signup({ searchParams }: { searchParams: Promise<{ invite?: string; next?: string }> }) {
  const { invite, next } = await searchParams;
  return <AuthForm mode="signup" action={signupAction} invite={invite} next={next} />;
}
