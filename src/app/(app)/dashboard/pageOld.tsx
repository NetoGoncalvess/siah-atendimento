import { Headset, CircleCheck, ClockAlert, X } from "lucide-react";

const CARDS = [
  { label: "Total de chamados", value: "—", icon: Headset, color: "blue" },
  { label: "Resolvidos", value: "—", icon: CircleCheck, color: "green" },
  { label: "Em andamento", value: "—", icon: ClockAlert, color: "orange" },
  { label: "Cancelados", value: "—", icon: X, color: "red" },
] as const;

const COLOR_CLASSES: Record<string, string> = {
  blue: "bg-blue/10 text-blue",
  green: "bg-green/10 text-green",
  orange: "bg-orange/10 text-orange",
  red: "bg-red/10 text-red",
};

export default function DashboardPage() {
  return (
    <div className="p-6">
      <div className="mb-1 text-xl font-bold text-text-primary">Dashboard de Atendimentos</div>
      <div className="mb-6 text-sm text-text-secondary">
        Visão geral dos atendimentos registrados pelo sistema.
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CARDS.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${COLOR_CLASSES[color]}`}>
              <Icon size={18} />
            </div>
            <div className="text-2xl font-bold text-text-primary">{value}</div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
              {label}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-6 text-sm text-text-secondary">
        Os gráficos e a tabela de atendimentos serão conectados ao banco de dados
        na próxima fase, reaproveitando o layout do dashboard atual (que hoje lê o
        Excel exportado do Dropdesk).
      </div>
    </div>
  );
}
