/**
 * Exports the canonical, machine-readable taxonomy this project owns —
 * elements (base + derived), creature families, and (v2) everything the
 * oracle pipeline consumers extract: escolas, recursos, profissões, talentos,
 * criaturas, and the generational-allocation dials (geracoes + cascata rules).
 *
 * This is the AI-first contract other projects in the ecosystem (Soulmon,
 * besti-rio-, teste-personalidade) are meant to consume instead of inventing
 * their own vocabulary — the PRIMARY use of this repo is serving that
 * pipeline; the human simulator UI is secondary. Regenerate after any change
 * to the registries:
 *
 *   npx tsx scripts/export-taxonomy.ts
 *
 * Versioned: bump `version` on breaking shape changes (consumers pin on it).
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ELEMENTOS } from "../src/registry/elementos";
import { CRIATURAS, FAMILIAS } from "../src/registry/criaturas";
import { ESCOLAS } from "../src/registry/escolas";
import { RECURSOS } from "../src/registry/recursos";
import { PROFISSOES } from "../src/registry/profissoes";
import { TALENTOS } from "../src/registry/talentos";
import {
  CUSTO_CASCATA_EQUIVALENTE,
  CUSTO_PONTO_ALOCACAO,
  DIVISOR_CASCATA,
  DIVISOR_CASCATA_ESPECIAL,
  LIMIAR_DESTRAVAMENTO,
  ORCAMENTO_POR_TIER,
} from "../src/registry/geracoes";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const elements = Object.values(ELEMENTOS).map((def) => ({
  id: def.id,
  nome: def.nome,
  tipo: def.tipo,
  descricao: def.descricao,
  fatorPotencia: def.fatorPotencia,
  pesos: def.pesos,
  receita: def.receita?.map((r) => ({ elemento: r.elemento, nivelMinimo: r.nivelMinimo })) ?? null,
  cascata: def.cascata ?? null,
}));

const families = Object.entries(FAMILIAS).map(([id, def]) => ({
  id,
  nome: def.nome,
  descricao: def.descricao,
}));

const escolas = Object.fromEntries(
  Object.entries(ESCOLAS).map(([id, e]) => [id, { nome: e.nome, descricao: e.descricao }]),
);
const recursos = Object.fromEntries(
  Object.entries(RECURSOS).map(([id, r]) => [id, { nome: r.nome, descricao: r.descricao }]),
);
const profissoes = Object.fromEntries(
  Object.entries(PROFISSOES).map(([id, p]) => [id, {
    nome: p.nome,
    fatoresElementos: p.fatoresElementos,
    ...(p.fatoresEscolas ? { fatoresEscolas: p.fatoresEscolas } : {}),
  }]),
);
const talentos = Object.fromEntries(
  Object.entries(TALENTOS).map(([id, t]) => [id, {
    nome: t.nome,
    ranksMaximos: t.ranksMaximos,
    ...(t.requisito ? { requisito: t.requisito } : {}),
    ...(t.exclusivoCom ? { exclusivoCom: t.exclusivoCom } : {}),
  }]),
);
const criaturas = Object.fromEntries(
  Object.entries(CRIATURAS).map(([id, c]) => [id, {
    nome: c.nome, familia: c.familia, afinidades: c.afinidades, poderBase: c.poderBase,
  }]),
);

const taxonomy = {
  $schema: "https://github.com/HexerVoodoom/class-system taxonomy export — see scripts/export-taxonomy.ts",
  version: 2,
  generatedFrom: "src/registry/*.ts",
  geracoes: {
    divisorCascata: DIVISOR_CASCATA,
    divisorCascataEspecial: DIVISOR_CASCATA_ESPECIAL,
    limiarDestravamento: LIMIAR_DESTRAVAMENTO,
    custoPontoAlocacao: CUSTO_PONTO_ALOCACAO,
    custoCascataEquivalente: CUSTO_CASCATA_EQUIVALENTE,
    orcamentoPorTier: ORCAMENTO_POR_TIER,
  },
  elements,
  families,
  escolas,
  recursos,
  profissoes,
  talentos,
  criaturas,
};

writeFileSync(join(root, "taxonomy.json"), JSON.stringify(taxonomy, null, 2) + "\n", "utf-8");
console.log(
  `Wrote taxonomy.json v2: ${elements.length} elements, ${families.length} families, ` +
  `${Object.keys(talentos).length} talentos, ${Object.keys(profissoes).length} profissões, ` +
  `${Object.keys(criaturas).length} criaturas.`,
);
