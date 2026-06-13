"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Headset, LayoutDashboard, Settings, LogOut } from "lucide-react";

const NAV_ITEMS = [
  { href: "/inbox", label: "Atendimentos", icon: Headset },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue/10 text-blue">
          <Headset size={18} />
        </div>
        <div>
          <div className="text-sm font-bold text-text-primary">SIAH Atendimento</div>
          <div className="text-xs text-text-tertiary">Painel interno</div>
        </div>
      </div>

      <nav className="flex-1 px-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-blue/10 text-blue"
                  : "text-text-secondary hover:bg-secondary hover:text-text-primary"
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-secondary hover:text-text-primary">
          <LogOut size={18} />
          Sair
        </button>
      </div>
    </aside>
  );
}
