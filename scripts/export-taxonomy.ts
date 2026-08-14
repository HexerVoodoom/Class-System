/**
 * Exports the canonical, machine-readable taxonomy this project owns —
 * elements (base + derived) and creature families — as a single JSON file.
 *
 * This is the AI-first contract other projects in the ecosystem (besti-rio-,
 * teste-personalidade) are meant to consume instead of inventing their own
 * element/family vocabulary. Regenerate after any change to
 * `src/registry/elementos.ts` or `src/registry/criaturas.ts`:
 *
 *   npx tsx scripts/export-taxonomy.ts
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ELEMENTOS } from "../src/registry/elementos";
import { FAMILIAS } from "../src/registry/criaturas";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const elements = Object.values(ELEMENTOS).map((def) => ({
  id: def.id,
  nome: def.nome,
  tipo: def.tipo,
  descricao: def.descricao,
  pesos: def.pesos,
  receita: def.receita?.map((r) => ({ elemento: r.elemento, nivelMinimo: r.nivelMinimo })) ?? null,
}));

const families = Object.entries(FAMILIAS).map(([id, def]) => ({
  id,
  nome: def.nome,
  descricao: def.descricao,
}));

const taxonomy = {
  $schema: "https://github.com/HexerVoodoom/class-system taxonomy export — see scripts/export-taxonomy.ts",
  generatedFrom: "src/registry/elementos.ts + src/registry/criaturas.ts",
  elements,
  families,
};

writeFileSync(join(root, "taxonomy.json"), JSON.stringify(taxonomy, null, 2) + "\n", "utf-8");
console.log(`Wrote taxonomy.json: ${elements.length} elements, ${families.length} families.`);
