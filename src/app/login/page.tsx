import { Headset } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue/10 text-blue">
            <Headset size={24} />
          </div>
          <h1 className="text-lg font-bold text-text-primary">SIAH Atendimento</h1>
          <p className="mt-1 text-sm text-text-secondary">Entre com sua conta de atendente</p>
        </div>

        <form className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-secondary">E-mail</label>
            <input
              type="email"
              placeholder="voce@siahtech.com.br"
              className="rounded-lg border border-border-md bg-card px-3 py-2 text-sm outline-none focus:border-blue"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-secondary">Senha</label>
            <input
              type="password"
              placeholder="••••••••"
              className="rounded-lg border border-border-md bg-card px-3 py-2 text-sm outline-none focus:border-blue"
            />
          </div>
          <button
            type="submit"
            className="mt-2 rounded-lg bg-blue px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Entrar
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-text-tertiary">
          A autenticação real será conectada na próxima fase do projeto.
        </p>
      </div>
    </div>
  );
}
