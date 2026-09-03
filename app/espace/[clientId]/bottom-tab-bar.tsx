"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, Dumbbell, Video, Utensils, Ruler, HeartHandshake } from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  { key: "planning", label: "Planning", icon: CalendarCheck },
  { key: "programme", label: "Programme", icon: Dumbbell },
  { key: "videos", label: "Vidéo", icon: Video },
  { key: "diete", label: "Diète", icon: Utensils },
  { key: "bilan", label: "Bilan", icon: Ruler },
  { key: "accompagnement", label: "Suivi", icon: HeartHandshake },
] as const;

export function BottomTabBar({ clientId }: { clientId: string }) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur">
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-1">
        {TABS.map((tab) => {
          const href = `/espace/${clientId}/${tab.key}`;
          const active = pathname?.startsWith(href);
          const Icon = tab.icon;
          return (
            <li key={tab.key} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="size-5" />
                <span className="leading-none">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
