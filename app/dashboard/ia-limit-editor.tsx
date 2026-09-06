"use client";

import { useState, useTransition } from "react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateIaSpendLimit } from "./actions";

export function IaLimitEditor({
  clientId,
  spendTotal,
  spendCycle,
  spendLimit,
}: {
  clientId: string;
  spendTotal: number;
  spendCycle: number;
  spendLimit: number;
}) {
  const [value, setValue] = useState(String(spendLimit));
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    startTransition(async () => {
      await updateIaSpendLimit(clientId, parsed);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  const overLimit = spendCycle >= spendLimit;

  return (
    <div className="flex items-center gap-2 rounded-lg bg-secondary/60 px-2 py-1.5 text-xs">
      <span className={overLimit ? "font-semibold text-destructive" : "text-muted-foreground"}>
        💳 {spendCycle.toFixed(2)} $ ce mois-ci · {spendTotal.toFixed(2)} $ au total
      </span>
      <div className="ml-auto flex items-center gap-1">
        <span className="text-muted-foreground">Limite</span>
        <Input
          type="number"
          min={0}
          step={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-7 w-16 px-1.5 text-xs"
        />
        <Button type="button" size="sm" className="h-7 px-2 text-xs" disabled={pending} onClick={save}>
          {saved ? "✓" : "OK"}
        </Button>
      </div>
    </div>
  );
}
