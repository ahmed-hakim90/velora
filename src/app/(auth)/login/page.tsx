import { LoginForm } from "@/modules/auth/components/login-form";

export default async function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center overflow-hidden p-4">
      <LoginForm />
    </main>
  );
}
