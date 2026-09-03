import { getSettings } from "@/lib/settings";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const settings = await getSettings();
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <div className="mb-1 h-1.5 w-10 rounded-full bg-primary" aria-hidden />
          <h1 className="text-2xl font-bold leading-tight">{settings.companyName}</h1>
          <p className="mt-1 text-sm text-neutral-500">Parcel &amp; document booking portal</p>
        </div>
        <LoginForm />
        <p className="mt-6 text-xs text-neutral-400">
          Trouble signing in? Contact the office to reset your access.
        </p>
      </div>
    </main>
  );
}
