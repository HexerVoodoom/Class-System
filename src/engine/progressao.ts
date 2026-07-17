/**
 * Motor de progressão: transforma os pontos diretos da ficha em
 *  1. níveis EFETIVOS de elementos base (diretos + transbordo de sinergias);
 *  2. níveis de elementos derivados (menor nível efetivo dos componentes,
 *     desde que todos atinjam o mínimo da receita);
 *  3. arquétipos desbloqueados (combinações de elemento + escola + recurso).
 *
 * O transbordo é calculado só a partir de pontos DIRETOS (uma passada),
 * para o sistema ser previsível e sem ciclos de realimentação.
 */

import {
  ELEMENTOS,
  SINERGIAS,
  type ElementoId,
} from '../registry/elementos';
import { ARQUETIPOS, type ArquetipoDef } from '../registry/arquetipos';
import type { Personagem } from './personagem';

export interface Progressao {
  /** Nível efetivo de todo elemento (base com transbordo + derivados). */
  niveisEfetivos: Record<ElementoId, number>;
  /** Detalhe do transbordo recebido por elemento base. */
  transbordo: Partial<Record<ElementoId, number>>;
  /** Elementos com nível efetivo > 0, utilizáveis em skills. */
  elementosDisponiveis: ElementoId[];
  arquetipos: ArquetipoDef[];
  capacidades: Set<string>;
}

export function calcularProgressao(p: Personagem): Progressao {
  const niveis = {} as Record<ElementoId, number>;
  const transbordo: Partial<Record<ElementoId, number>> = {};

  for (const id of Object.keys(ELEMENTOS) as ElementoId[]) niveis[id] = 0;

  // 1) pontos diretos
  for (const [id, pontos] of Object.entries(p.elementos) as [ElementoId, number][]) {
    niveis[id] += pontos;
  }

  // 2) transbordo de sinergias (a partir dos pontos diretos)
  for (const s of SINERGIAS) {
    const origem = p.elementos[s.de] ?? 0;
    const bonus = Math.floor(origem * s.razao);
    if (bonus <= 0) continue;
    for (const alvo of s.para) {
      niveis[alvo] += bonus;
      transbordo[alvo] = (transbordo[alvo] ?? 0) + bonus;
    }
  }

  // 3) derivados: exigem todos os componentes no mínimo da receita;
  //    nível = menor nível efetivo entre os componentes (evolução conjunta).
  for (const def of Object.values(ELEMENTOS)) {
    if (!def.receita) continue;
    const niveisComponentes = def.receita.map((c) => niveis[c.elemento]);
    const atendeMinimos = def.receita.every((c) => niveis[c.elemento] >= c.nivelMinimo);
    niveis[def.id] = atendeMinimos ? Math.min(...niveisComponentes) : 0;
  }

  // 4) arquétipos
  const arquetipos: ArquetipoDef[] = [];
  const capacidades = new Set<string>();
  for (const arq of Object.values(ARQUETIPOS)) {
    const c = arq.condicao;
    const okElementos = Object.entries(c.elementos ?? {}).every(
      ([id, min]) => niveis[id as ElementoId] >= (min ?? 0),
    );
    const okEscolas = Object.entries(c.escolas ?? {}).every(
      ([id, min]) => (p.escolas[id as keyof typeof p.escolas] ?? 0) >= (min ?? 0),
    );
    const okRecursos = Object.entries(c.recursos ?? {}).every(
      ([id, min]) => (p.recursos[id as keyof typeof p.recursos] ?? 0) >= (min ?? 0),
    );
    if (okElementos && okEscolas && okRecursos) {
      arquetipos.push(arq);
      for (const cap of arq.capacidades) capacidades.add(cap);
    }
  }

  const elementosDisponiveis = (Object.keys(niveis) as ElementoId[]).filter(
    (id) => niveis[id] > 0,
  );

  return { niveisEfetivos: niveis, transbordo, elementosDisponiveis, arquetipos, capacidades };
}
