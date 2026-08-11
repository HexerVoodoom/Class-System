/**
 * Tabela de afinidade elemental (pedra-papel-tesoura), inspirada no gráfico
 * de elementos de Ragnarok, nas fraquezas de Final Fantasy e nas
 * resistências de D&D.
 *
 * Cada elemento base declara contra quais elementos é FORTE (dano
 * amplificado) e FRACO (dano reduzido). Elementos derivados herdam a tabela
 * do primeiro componente da sua receita. Físico (vigor/marcial) é neutro.
 */

import { ELEMENTOS, type ElementoBaseId, type ElementoId } from './elementos';

export const MULT_FORTE = 1.5;
export const MULT_FRACO = 0.5;
export const MULT_NEUTRO = 1;

export interface AfinidadeDef {
  forteContra: ElementoBaseId[];
  fracoContra: ElementoBaseId[];
}

/** Relações por elemento base. Vazio = neutro contra tudo (físico). */
export const AFINIDADES: Record<ElementoBaseId, AfinidadeDef> = {
  fogo: { forteContra: ['vida', 'terra'], fracoContra: ['agua'] },
  agua: { forteContra: ['fogo'], fracoContra: ['eletricidade', 'vida'] },
  terra: { forteContra: ['eletricidade'], fracoContra: ['ar', 'fogo'] },
  ar: { forteContra: ['terra'], fracoContra: ['eletricidade'] },
  eletricidade: { forteContra: ['agua', 'ar'], fracoContra: ['terra'] },
  arcano: { forteContra: ['vigor', 'marcial'], fracoContra: ['sombra'] },
  sombra: { forteContra: ['luz', 'arcano'], fracoContra: ['luz'] },
  luz: { forteContra: ['sombra', 'morte', 'vileza'], fracoContra: [] },
  vileza: { forteContra: ['vida'], fracoContra: ['luz'] },
  morte: { forteContra: ['vida'], fracoContra: ['luz'] },
  vida: { forteContra: ['morte', 'vileza'], fracoContra: ['fogo', 'morte'] },
  vigor: { forteContra: [], fracoContra: ['arcano'] },
  marcial: { forteContra: [], fracoContra: ['arcano'] },
};

/** Reduz um elemento (base ou derivado) ao seu elemento base dominante. */
export function baseDominante(elemento: ElementoId): ElementoBaseId {
  const def = ELEMENTOS[elemento];
  if (!def) return 'arcano';
  if (def.tipo === 'base') return elemento as ElementoBaseId;
  return (def.receita?.[0]?.elemento ?? 'arcano') as ElementoBaseId;
}

/**
 * Multiplicador de efetividade de um elemento atacante contra a afinidade
 * de um alvo. Físico (sem relações) é sempre neutro.
 */
export function efetividade(atacante: ElementoId, alvo: ElementoBaseId): number {
  const base = baseDominante(atacante);
  const af = AFINIDADES[base];
  if (!af) return MULT_NEUTRO;
  if (af.forteContra.includes(alvo)) return MULT_FORTE;
  if (af.fracoContra.includes(alvo)) return MULT_FRACO;
  return MULT_NEUTRO;
}

export function rotuloEfetividade(mult: number): string {
  if (mult > 1) return 'forte';
  if (mult < 1) return 'fraco';
  return 'neutro';
}
