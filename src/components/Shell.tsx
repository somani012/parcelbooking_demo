"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logout } from "@/actions/auth";

export type NavItem = { href: string; label: string };

export function Shell({
  nav,
  userName,
  roleLabel,
  companyName,
  children,
}: {
  nav: NavItem[];
  userName: string;
  roleLabel: string;
  companyName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = (
    <ul className="space-y-0.5">
      {nav.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={() => setOpen(false)}
              className={`block rounded px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-primary text-white" : "text-neutral-200 hover:bg-white/10"
              }`}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Mobile top bar */}
      <header className="flex items-center justify-between bg-ink px-4 py-3 text-white lg:hidden">
        <div>
          <p className="text-sm font-bold">{companyName}</p>
          <p className="text-xs text-neutral-400">{roleLabel}</p>
        </div>
        <button
          className="rounded border border-white/20 px-3 py-1.5 text-sm"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? "Close" : "Menu"}
        </button>
      </header>
      {open && (
        <nav className="bg-ink px-4 pb-4 text-white lg:hidden">
          {links}
          <form action={logout} className="mt-3 border-t border-white/10 pt-3">
            <button className="w-full rounded px-3 py-2 text-left text-sm text-neutral-300 hover:bg-white/10">
              Log out ({userName})
            </button>
          </form>
        </nav>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col bg-ink text-white lg:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="mb-2 h-1.5 w-8 rounded-full bg-primary" aria-hidden />
          <p className="font-bold leading-tight">{companyName}</p>
          <p className="mt-0.5 text-xs text-neutral-400">{roleLabel}</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">{links}</nav>
        <div className="border-t border-white/10 px-5 py-4">
          <p className="truncate text-sm font-medium">{userName}</p>
          <form action={logout}>
            <button className="mt-1 text-xs text-neutral-400 underline-offset-2 hover:text-white hover:underline">
              Log out
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
