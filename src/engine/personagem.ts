/**
 * Ficha de personagem: apenas os pontos DIRETOS que o jogador distribuiu.
 * Tudo o mais (níveis efetivos, derivados, arquétipos) é calculado pelo
 * motor de progressão a partir daqui.
 */

import { ELEMENTOS, type ElementoId } from '../registry/elementos';
import { ESCOLAS, type EscolaId } from '../registry/escolas';
import { RECURSOS, type RecursoId } from '../registry/recursos';
import { TALENTOS, type TalentoId } from '../registry/talentos';
import { CRIATURAS } from '../registry/criaturas';
import { avaliarCaptura, capacidadeVinculo } from './evocacao';
import type { Progressao } from './progressao';

/** Uma criatura no bestiário do jogador. nivelVinculo 0 = capturada, não domada. */
export interface CriaturaCapturada {
  criaturaId: string;
  nivelVinculo: number;
}

export const MAX_NIVEL_VINCULO = 5;

export interface Personagem {
  nome: string;
  /** Pontos diretos por elemento BASE (derivados não aceitam pontos). */
  elementos: Partial<Record<ElementoId, number>>;
  escolas: Partial<Record<EscolaId, number>>;
  /** Proficiência em cada recurso (pool/eficiência). */
  recursos: Partial<Record<RecursoId, number>>;
  talentos: Partial<Record<TalentoId, number>>;
  /** Criaturas capturadas (e eventualmente domadas). */
  bestiario: CriaturaCapturada[];
}

export function criarPersonagem(nome: string): Personagem {
  return { nome, elementos: {}, escolas: {}, recursos: {}, talentos: {}, bestiario: [] };
}

export function investirElemento(p: Personagem, elemento: ElementoId, pontos: number): void {
  const def = ELEMENTOS[elemento];
  if (!def) throw new Error(`Elemento desconhecido: ${elemento}`);
  if (def.tipo !== 'base') {
    throw new Error(
      `"${def.nome}" é ${def.tipo}: não aceita pontos diretos. Ele evolui pelos componentes da receita.`,
    );
  }
  if (pontos <= 0 || !Number.isInteger(pontos)) throw new Error('Pontos devem ser inteiros positivos.');
  p.elementos[elemento] = (p.elementos[elemento] ?? 0) + pontos;
}

export function investirEscola(p: Personagem, escola: EscolaId, pontos: number): void {
  if (!ESCOLAS[escola]) throw new Error(`Escola desconhecida: ${escola}`);
  if (pontos <= 0 || !Number.isInteger(pontos)) throw new Error('Pontos devem ser inteiros positivos.');
  p.escolas[escola] = (p.escolas[escola] ?? 0) + pontos;
}

export function investirRecurso(p: Personagem, recurso: RecursoId, pontos: number): void {
  if (!RECURSOS[recurso]) throw new Error(`Recurso desconhecido: ${recurso}`);
  if (pontos <= 0 || !Number.isInteger(pontos)) throw new Error('Pontos devem ser inteiros positivos.');
  p.recursos[recurso] = (p.recursos[recurso] ?? 0) + pontos;
}

export function investirTalento(p: Personagem, talento: TalentoId, ranks: number): void {
  const def = TALENTOS[talento];
  if (!def) throw new Error(`Talento desconhecido: ${talento}`);
  if (ranks <= 0 || !Number.isInteger(ranks)) throw new Error('Ranks devem ser inteiros positivos.');

  const atual = p.talentos[talento] ?? 0;
  if (atual + ranks > def.ranksMaximos) {
    throw new Error(`"${def.nome}" tem no máximo ${def.ranksMaximos} ranks.`);
  }
  if (def.requisito) {
    const { escola, recurso, nivelMinimo } = def.requisito;
    if (escola && (p.escolas[escola] ?? 0) < nivelMinimo) {
      throw new Error(`"${def.nome}" exige ${nivelMinimo} pontos em ${ESCOLAS[escola].nome}.`);
    }
    if (recurso && (p.recursos[recurso] ?? 0) < nivelMinimo) {
      throw new Error(
        `"${def.nome}" exige proficiência ${nivelMinimo} no recurso ${RECURSOS[recurso].nome}.`,
      );
    }
  }
  for (const rival of def.exclusivoCom ?? []) {
    if ((p.talentos[rival] ?? 0) > 0) {
      throw new Error(
        `"${def.nome}" é exclusivo com "${TALENTOS[rival].nome}" — remova os ranks rivais primeiro.`,
      );
    }
  }
  p.talentos[talento] = atual + ranks;
}

// ---- bestiário: captura e doma ----

/** Captura uma criatura, se a afinidade/poder permitirem. Idempotente por id. */
export function capturarCriatura(p: Personagem, prog: Progressao, criaturaId: string): void {
  if (!CRIATURAS[criaturaId]) throw new Error(`Criatura desconhecida: ${criaturaId}`);
  if (p.bestiario.some((c) => c.criaturaId === criaturaId)) {
    throw new Error('Essa criatura já está no seu bestiário.');
  }
  const av = avaliarCaptura(p, prog, criaturaId);
  if (!av.capturavel) throw new Error(av.motivo ?? 'Não é possível capturar esta criatura.');
  p.bestiario.push({ criaturaId, nivelVinculo: 0 });
}

export function soltarCriatura(p: Personagem, criaturaId: string): void {
  p.bestiario = p.bestiario.filter((c) => c.criaturaId !== criaturaId);
}

/** Aumenta o vínculo de doma em 1, respeitando capacidade e talento. */
export function domarCriatura(p: Personagem, criaturaId: string): void {
  const entrada = p.bestiario.find((c) => c.criaturaId === criaturaId);
  if (!entrada) throw new Error('Capture a criatura antes de domá-la.');
  const capacidade = capacidadeVinculo(p);
  if (capacidade <= 0) {
    throw new Error('Requer o talento Vínculo Primal (Doma) para criar vínculo.');
  }
  const jaVinculadas = p.bestiario.filter((c) => c.nivelVinculo > 0).length;
  if (entrada.nivelVinculo === 0 && jaVinculadas >= capacidade) {
    throw new Error(
      `Capacidade de vínculo cheia (${capacidade}). Suba Matilha Domada ou solte o vínculo de outra fera.`,
    );
  }
  if (entrada.nivelVinculo >= MAX_NIVEL_VINCULO) {
    throw new Error(`Vínculo já está no máximo (${MAX_NIVEL_VINCULO}).`);
  }
  entrada.nivelVinculo += 1;
}

/** Reduz o vínculo em 1 (até 0 = apenas capturada). */
export function afrouxarVinculo(p: Personagem, criaturaId: string): void {
  const entrada = p.bestiario.find((c) => c.criaturaId === criaturaId);
  if (entrada && entrada.nivelVinculo > 0) entrada.nivelVinculo -= 1;
}
