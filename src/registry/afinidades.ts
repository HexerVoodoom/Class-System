/**
 * Tabela de afinidade elemental (pedra-papel-tesoura), inspirada no gráfico
 * de elementos de Ragnarok, nas fraquezas de Final Fantasy e nas
 * resistências de D&D.
 *
 * Cada elemento base declara contra quais elementos é FORTE (dano
 * amplificado) e FRACO (dano reduzido). Elementos derivados herdam a tabela
 * do primeiro componente da sua receita. Marcial é quase neutro: quem paga o preço de não ter elemento.
 */

import { ELEMENTOS, type ElementoBaseId, type ElementoDef, type ElementoId } from './elementos';

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
  // O arcano domina o físico e a própria trama; a sombra o engole.
  arcano: { forteContra: ['marcial', 'vida', 'gravidade'], fracoContra: ['sombra'] },
  sombra: { forteContra: ['luz', 'arcano'], fracoContra: ['luz'] },
  luz: { forteContra: ['sombra', 'morte', 'vileza'], fracoContra: [] },
  vileza: { forteContra: ['vida'], fracoContra: ['luz'] },
  morte: { forteContra: ['vida'], fracoContra: ['luz'] },
  // Vida absorveu o Vigor: continua forte contra o que apodrece, e agora
  // carrega a fraqueza física ao arcano que era do Vigor.
  vida: { forteContra: ['morte', 'vileza'], fracoContra: ['fogo', 'morte', 'arcano'] },
  marcial: { forteContra: [], fracoContra: ['arcano', 'gravidade'] },
  // Gravidade absorveu Espaço e Tempo: esmaga o físico e desgasta o vivo,
  // e é o arcano que a dobra.
  gravidade: { forteContra: ['marcial', 'vida'], fracoContra: ['arcano'] },
};


/**
 * Reduz uma DEFINIÇÃO de elemento ao seu base dominante. Trabalhar sobre a
 * definição (e não sobre o id) permite que combinações procedurais — que não
 * moram em `ELEMENTOS` — usem a mesma regra sem criar dependência circular
 * entre este registro e o de combinações.
 */
export function baseDominanteDoDef(def: ElementoDef | undefined): ElementoBaseId {
  if (!def) return 'arcano';
  if (def.tipo === 'base') return def.id as ElementoBaseId;
  return (def.receita?.[0]?.elemento ?? 'arcano') as ElementoBaseId;
}

/** Reduz um elemento (base ou derivado curado) ao seu elemento base dominante. */
export function baseDominante(elemento: ElementoId): ElementoBaseId {
  return baseDominanteDoDef(ELEMENTOS[elemento]);
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
