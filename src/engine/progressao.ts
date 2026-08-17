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
import {
  ARIDADE_MAXIMA,
  TODAS_COMBINACOES,
  type CombinacaoInfo,
} from '../registry/combinacoes';
import { ARQUETIPOS, type ArquetipoDef } from '../registry/arquetipos';
import { TALENTOS, type EfeitoTalento, type TalentoId } from '../registry/talentos';
import type { Personagem } from './personagem';

function somaEfeitos(
  p: Personagem,
  filtro: (e: EfeitoTalento, ranks: number) => number,
): number {
  let total = 0;
  for (const [id, ranks] of Object.entries(p.talentos) as [TalentoId, number][]) {
    if (!ranks) continue;
    for (const efeito of TALENTOS[id].efeitos) total += filtro(efeito, ranks);
  }
  return total;
}

export interface Progressao {
  /** Nível efetivo de todo elemento (base com transbordo + derivados). */
  niveisEfetivos: Record<ElementoId, number>;
  /** Detalhe do transbordo recebido por elemento base. */
  transbordo: Partial<Record<ElementoId, number>>;
  /** Quanto os talentos reduziram o mínimo exigido por cada receita. */
  reducaoMinimoReceita: number;
  /** Níveis extras concedidos a todo elemento derivado desbloqueado. */
  bonusNivelDerivado: number;
  /** Elementos com nível efetivo > 0, utilizáveis em skills. */
  elementosDisponiveis: ElementoId[];
  /**
   * Combinações de 3/4 componentes desbloqueadas — subconjunto minúsculo das
   * 3.060 possíveis. Só o que a ficha realmente alcançou é materializado.
   */
  combinacoesLiberadas: CombinacaoInfo[];
  arquetipos: ArquetipoDef[];
  capacidades: Set<string>;
  /**
   * MEIAS-IDENTIDADES. Combinações de 3+ componentes concedem versões
   * DILUÍDAS das capacidades dos arquétipos ligados aos seus sub-pares.
   *
   * É a resposta ao modo de falha clássico dos sistemas de aridade alta: se
   * combinar mais só desse um multiplicador maior, o jogador ótimo sempre
   * sobe a escada e as combinações menores viram conteúdo de passagem. Aqui,
   * combinar mais compra LARGURA DE IDENTIDADE — várias meias-classes em vez
   * de uma classe mais forte. Skills que exigem a capacidade funcionam com a
   * versão diluída, com penalidade de poder.
   */
  capacidadesDiluidas: Set<string>;
  /** Arquétipos de que o personagem tem apenas a meia-identidade. */
  arquetiposDiluidos: ArquetipoDef[];
}

/** Penalidade de poder ao usar uma capacidade em versão diluída. */
export const PENALIDADE_CAPACIDADE_DILUIDA = 0.18;

export function calcularProgressao(p: Personagem): Progressao {
  const niveis = {} as Record<ElementoId, number>;
  const transbordo: Partial<Record<ElementoId, number>> = {};

  for (const id of Object.keys(ELEMENTOS) as ElementoId[]) niveis[id] = 0;

  // talentos que mexem na própria estrutura de progressão
  const reducaoMinimoReceita = Math.floor(
    somaEfeitos(p, (e, r) => (e.tipo === 'receita_minimo_reducao' ? e.valorPorRank * r : 0)),
  );
  const bonusNivelDerivado = Math.floor(
    somaEfeitos(p, (e, r) => (e.tipo === 'nivel_derivado_bonus' ? e.valorPorRank * r : 0)),
  );
  const bonusTransbordo = somaEfeitos(p, (e, r) =>
    e.tipo === 'propriedade' && e.chave === 'transbordo_bonus' ? e.valorPorRank * r : 0,
  );

  // 1) pontos diretos
  for (const [id, pontos] of Object.entries(p.elementos) as [ElementoId, number][]) {
    niveis[id] += pontos;
  }

  // 2) transbordo de sinergias (a partir dos pontos diretos)
  for (const s of SINERGIAS) {
    const origem = p.elementos[s.de] ?? 0;
    const bonus = Math.floor(origem * s.razao * (1 + bonusTransbordo));
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
    const atendeMinimos = def.receita.every(
      (c) => niveis[c.elemento] >= Math.max(1, c.nivelMinimo - reducaoMinimoReceita),
    );
    niveis[def.id] = atendeMinimos
      ? Math.min(...niveisComponentes) + bonusNivelDerivado
      : 0;
  }

  // 4) combinações N-árias procedurais: o espaço completo é varrido (loop
  //    numérico barato), mas só as desbloqueadas entram no mapa de níveis —
  //    materializar nome/descrição das 3.060 seria desperdício.
  const combinacoesLiberadas: CombinacaoInfo[] = [];
  for (const info of TODAS_COMBINACOES) {
    if (niveis[info.id] !== undefined) continue; // já resolvida como curada
    const minimo = Math.max(1, info.nivelMinimo - reducaoMinimoReceita);
    let menor = Infinity;
    let atende = true;
    for (const comp of info.componentes) {
      const n = niveis[comp] ?? 0;
      if (n < minimo) {
        atende = false;
        break;
      }
      if (n < menor) menor = n;
    }
    if (!atende) continue;
    niveis[info.id] = menor + bonusNivelDerivado;
    combinacoesLiberadas.push(info);
  }

  // 5) arquétipos
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

  // 6) meias-identidades: cada combinação de 3+ componentes desbloqueada
  //    concede as capacidades — diluídas — dos arquétipos cujos elementos
  //    exigidos estão contidos na sua receita.
  const capacidadesDiluidas = new Set<string>();
  const arquetiposDiluidos: ArquetipoDef[] = [];
  const receitasAmplas: ElementoId[][] = [];
  for (const info of combinacoesLiberadas) receitasAmplas.push(info.componentes);
  for (const def of Object.values(ELEMENTOS)) {
    const n = def.receita?.length ?? 0;
    // A faixa 3..ARIDADE_MAXIMA não é arbitrária. A meia-identidade paga por
    // COMBINAR, e "combinar" no sistema significa 3 ou 4 componentes. As
    // receitas amplas escritas à mão (Primordial com 5, Ciclo com 4, Nulo com
    // os 17) escapavam por cima: a do Nulo contém, por construção, a exigência
    // elemental de quase todo arquétipo do registro — medido, 53 arquétipos e
    // 76 capacidades diluídas de uma vez, 61% do catálogo. Isso invertia a
    // regra que a mecânica existe para sustentar: o generalista passava a ter
    // meia versão de tudo, inclusive de coisas que nunca combinou.
    if (n >= 3 && n <= ARIDADE_MAXIMA && (niveis[def.id] ?? 0) > 0) {
      receitasAmplas.push(def.receita!.map((c) => c.elemento));
    }
  }
  if (receitasAmplas.length) {
    for (const arq of Object.values(ARQUETIPOS)) {
      if (arquetipos.includes(arq)) continue;
      const exigidos = Object.keys(arq.condicao.elementos ?? {}) as ElementoId[];
      if (!exigidos.length) continue;
      // o arquétipo é "meio alcançado" quando toda a exigência elemental dele
      // está contida na receita de alguma combinação ampla desbloqueada
      const contido = receitasAmplas.some((comps) => {
        const conjunto = new Set<string>(comps);
        for (const alvo of exigidos) {
          const def = ELEMENTOS[alvo];
          const partes = def?.receita?.map((c) => c.elemento as string) ?? [alvo as string];
          if (!partes.every((x) => conjunto.has(x))) return false;
        }
        return true;
      });
      if (!contido) continue;
      arquetiposDiluidos.push(arq);
      for (const cap of arq.capacidades) {
        if (!capacidades.has(cap)) capacidadesDiluidas.add(cap);
      }
    }
  }

  const elementosDisponiveis = (Object.keys(niveis) as ElementoId[]).filter(
    (id) => niveis[id] > 0,
  );

  return {
    niveisEfetivos: niveis,
    transbordo,
    reducaoMinimoReceita,
    bonusNivelDerivado,
    elementosDisponiveis,
    combinacoesLiberadas,
    arquetipos,
    capacidades,
    capacidadesDiluidas,
    arquetiposDiluidos,
  };
}
