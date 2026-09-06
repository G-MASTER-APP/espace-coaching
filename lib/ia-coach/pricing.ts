// Tarifs Claude Sonnet 5, par million de tokens — mêmes tarifs que le calcul
// équivalent côté G-MASTER-PROGRAM. À vérifier/ajuster sur
// console.anthropic.com/settings/billing si Anthropic change ses prix.
const INPUT_USD_PER_MTOK = 3;
const OUTPUT_USD_PER_MTOK = 15;

export function computeCostUsd(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * INPUT_USD_PER_MTOK +
    (outputTokens / 1_000_000) * OUTPUT_USD_PER_MTOK
  );
}

export function computeCycleStart(today: Date): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
}
