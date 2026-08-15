/**
 * CONSULTAS — a superfície do Class System legível por máquina.
 *
 * O motor (`engine/`) responde "quanto vale esta configuração?". Esta camada
 * responde as perguntas que um **agente** ou um **programa** de fato faz:
 *
 *   - o que esta ficha já alcançou?
 *   - o que está a um passo, e quantos pontos custa?
 *   - qual o caminho mais barato até este arquétipo?
 *   - por que esta skill é inválida, e o que destrava?
 *   - o que existe no sistema com este nome?
 *
 * Três regras que valem para tudo aqui:
 *
 *  1. **Determinismo.** Mesma entrada → mesma saída, byte a byte. Toda
 *     ordenação tem desempate estável por id. Sem relógio, sem aleatório.
 *  2. **Orçamento de contexto.** Toda consulta que pode devolver muita coisa
 *     tem um `limite` com default modesto, e informa quanto ficou de fora.
 *  3. **Erro que ensina.** Diagnóstico traz o motivo E o que fazer a respeito,
 *     porque quem consome isto não tem como adivinhar.
 */

import {
  ELEMENTOS,
  SINERGIAS,
  elementosBase,
  type ElementoBaseId,
  type ElementoId,
} from '../registry/elementos';
import {
  TODAS_COMBINACOES,
  buscarCombinacoes,
  chaveCombinacao,
  coesaoDe,
  combinacaoInfo,
  elementoDef,
  progressoCombinacao,
  ROTULO_COERENCIA,
  type CombinacaoInfo,
} from '../registry/combinacoes';
import { ARQUETIPOS, type ArquetipoDef } from '../registry/arquetipos';
import { ESCOLAS, type EscolaId } from '../registry/escolas';
import { RECURSOS, type RecursoId } from '../registry/recursos';
import { TALENTOS, type TalentoId } from '../registry/talentos';
import { PROFISSOES, PROPRIEDADES_ITEM, ITENS_BASE } from '../registry/profissoes';
import { MODIFICADORES, ROTULO_TAG, type ModificadorId } from '../registry/modificadores';
import { CRIATURAS } from '../registry/criaturas';
import { calcularProgressao, type Progressao } from '../engine/progressao';
import { criarPersonagem, type Personagem } from '../engine/personagem';
import {
  avaliarModificador,
  calcularSkill,
  slotsModificador,
  tagsDaSkill,
  validarSkill,
  type SkillConfig,
} from '../engine/skills';
import { MODOS_FUSAO, calcularFusao, previewFusao, type FusaoConfig } from '../engine/fusao';

const BASES = elementosBase().map((e) => e.id as ElementoBaseId);

/** Ordenação estável: critério principal, desempate sempre por id. */
function ordenar<T>(itens: T[], chave: (x: T) => number, id: (x: T) => string): T[] {
  return [...itens].sort((a, b) => chave(b) - chave(a) || id(a).localeCompare(id(b)));
}

// ---------------------------------------------------------------------------
// 1. Panorama do sistema
// ---------------------------------------------------------------------------

export interface Panorama {
  elementosBase: number;
  pares: number;
  triplas: number;
  quadruplas: number;
  elementosAlcancaveis: number;
  combinacoesCuradas: number;
  escolas: number;
  recursos: number;
  talentos: number;
  arquetipos: number;
  profissoes: number;
  itensBase: number;
  propriedadesItem: number;
  modificadores: number;
  modosDeFusao: number;
  criaturas: number;
}

/**
 * O tamanho do sistema em números. É a primeira consulta que um agente sem
 * contexto deve fazer: barata, e situa a escala de tudo mais.
 */
export function panorama(): Panorama {
  const ids = new Set(Object.keys(ELEMENTOS));
  for (const c of TODAS_COMBINACOES) ids.add(c.id);
  return {
    elementosBase: BASES.length,
    pares: Object.values(ELEMENTOS).filter((d) => d.receita?.length === 2).length,
    triplas: TODAS_COMBINACOES.filter((c) => c.aridade === 3).length,
    quadruplas: TODAS_COMBINACOES.filter((c) => c.aridade === 4).length,
    elementosAlcancaveis: ids.size,
    combinacoesCuradas: TODAS_COMBINACOES.filter((c) => c.curada).length,
    escolas: Object.keys(ESCOLAS).length,
    recursos: Object.keys(RECURSOS).length,
    talentos: Object.keys(TALENTOS).length,
    arquetipos: Object.keys(ARQUETIPOS).length,
    profissoes: Object.keys(PROFISSOES).length,
    itensBase: Object.keys(ITENS_BASE).length,
    propriedadesItem: Object.keys(PROPRIEDADES_ITEM).length,
    modificadores: Object.keys(MODIFICADORES).length,
    modosDeFusao: Object.keys(MODOS_FUSAO).length,
    criaturas: Object.keys(CRIATURAS).length,
  };
}

// ---------------------------------------------------------------------------
// 2. Requisitos base de qualquer elemento
// ---------------------------------------------------------------------------

/**
 * Traduz "quero o elemento X no nível N" para os níveis EFETIVOS que cada
 * elemento base precisa ter. Resolve receitas recursivamente, e respeita o
 * nível mínimo de cada componente.
 *
 * É a peça central de todo planejamento: arquétipos, combinações e
 * propriedades de item são todos declarados em cima de elementos, e só isto
 * converte a declaração em pontos.
 */
export function requisitosBase(
  elemento: ElementoId,
  nivel: number,
  acumulado: Partial<Record<ElementoBaseId, number>> = {},
): Partial<Record<ElementoBaseId, number>> {
  const def = elementoDef(elemento);
  if (!def) return acumulado;
  if (def.tipo === 'base') {
    const id = def.id as ElementoBaseId;
    acumulado[id] = Math.max(acumulado[id] ?? 0, nivel);
    return acumulado;
  }
  for (const comp of def.receita ?? []) {
    // o derivado vale o MENOR nível entre os componentes, e cada um precisa
    // atingir o mínimo da receita — logo o alvo é o maior dos dois
    requisitosBase(comp.elemento, Math.max(nivel, comp.nivelMinimo), acumulado);
  }
  return acumulado;
}

function fichaCom(
  elementos: Partial<Record<ElementoBaseId, number>>,
  escolas: Partial<Record<EscolaId, number>> = {},
  recursos: Partial<Record<RecursoId, number>> = {},
  talentos: Partial<Record<TalentoId, number>> = {},
): Personagem {
  const p = criarPersonagem('planejamento');
  p.elementos = { ...elementos };
  p.escolas = { ...escolas };
  p.recursos = { ...recursos };
  p.talentos = { ...talentos };
  return p;
}

/**
 * Converte níveis efetivos exigidos em PONTOS DIRETOS, aproveitando o
 * transbordo das sinergias. Um alvo de vigor 12 fica mais barato se a ficha já
 * investe em vida, porque vida vaza para vigor.
 *
 * A descida é gulosa e sempre verificada: se o desconto por sinergia deixar de
 * atender o alvo, a função devolve a solução ingênua (sem desconto), que é
 * correta por construção. Nunca devolve um plano que não funciona.
 */
export function pontosDiretosPara(
  alvoEfetivo: Partial<Record<ElementoBaseId, number>>,
  base: Partial<Record<ElementoBaseId, number>> = {},
): Partial<Record<ElementoBaseId, number>> {
  const ingenuo: Partial<Record<ElementoBaseId, number>> = { ...base };
  for (const [id, n] of Object.entries(alvoEfetivo) as [ElementoBaseId, number][]) {
    ingenuo[id] = Math.max(ingenuo[id] ?? 0, n);
  }
  const atende = (direto: Partial<Record<ElementoBaseId, number>>): boolean => {
    const prog = calcularProgressao(fichaCom(direto));
    return (Object.entries(alvoEfetivo) as [ElementoBaseId, number][]).every(
      ([id, n]) => (prog.niveisEfetivos[id] ?? 0) >= n,
    );
  };

  let atual = { ...ingenuo };
  for (let iter = 0; iter < 8; iter++) {
    const prog = calcularProgressao(fichaCom(atual));
    let mudou = false;
    // ordem determinística: sempre a mesma varredura
    for (const id of BASES) {
      const alvo = alvoEfetivo[id] ?? 0;
      const minimoDaBase = base[id] ?? 0;
      const excedente = (prog.niveisEfetivos[id] ?? 0) - alvo;
      const atualId = atual[id] ?? 0;
      if (excedente > 0 && atualId > minimoDaBase) {
        const novo = Math.max(minimoDaBase, atualId - excedente);
        if (novo !== atualId) {
          atual[id] = novo;
          mudou = true;
        }
      }
    }
    if (!mudou) break;
  }
  if (!atende(atual)) atual = ingenuo;
  for (const id of BASES) if (!atual[id]) delete atual[id];
  return atual;
}

export function totalDePontos(m: Partial<Record<string, number>>): number {
  return Object.values(m).reduce<number>((s, n) => s + (n ?? 0), 0);
}

// ---------------------------------------------------------------------------
// 3. Análise de uma ficha
// ---------------------------------------------------------------------------

export interface ResumoElemento {
  id: ElementoId;
  nome: string;
  tipo: string;
  aridade: number;
  nivel: number;
  /** Só em derivados: quanto veio de transbordo em cada componente. */
  componentes?: string[];
}

export interface AnaliseFicha {
  nome: string;
  pontos: {
    elementos: number;
    escolas: number;
    recursos: number;
    talentos: number;
    profissoes: number;
    total: number;
  };
  elementosBase: { id: ElementoBaseId; direto: number; transbordo: number; efetivo: number }[];
  derivadosAbertos: ResumoElemento[];
  combinacoesAbertas: number;
  arquetipos: { id: string; nome: string; capacidades: string[] }[];
  arquetiposDiluidos: { id: string; nome: string }[];
  capacidades: string[];
  capacidadesDiluidas: string[];
  talentos: { id: TalentoId; nome: string; ranks: number; maximo: number }[];
  avisos: string[];
}

/** Leitura completa de uma ficha: o que ela é hoje. */
export function analisarFicha(p: Personagem, limiteDerivados = 40): AnaliseFicha {
  const prog = calcularProgressao(p);
  const derivados: ResumoElemento[] = [];
  for (const id of prog.elementosDisponiveis) {
    const def = elementoDef(id);
    if (!def || def.tipo === 'base') continue;
    derivados.push({
      id,
      nome: def.nome,
      tipo: def.tipo,
      aridade: def.receita?.length ?? 0,
      nivel: prog.niveisEfetivos[id] ?? 0,
      componentes: def.receita?.map((c) => ELEMENTOS[c.elemento].nome),
    });
  }
  const ordenados = ordenar(derivados, (d) => d.nivel * 100 + d.aridade, (d) => String(d.id));

  const avisos: string[] = [];
  if (!Object.keys(p.escolas).length) {
    avisos.push('Nenhuma escola investida — sem escola não é possível criar skill alguma.');
  }
  if (!Object.keys(p.recursos).length) {
    avisos.push('Nenhum recurso com proficiência — toda skill precisa de ao menos uma fonte de energia.');
  }
  if (!prog.elementosDisponiveis.length) {
    avisos.push('Nenhum elemento investido — a ficha não consegue lançar nada.');
  }

  return {
    nome: p.nome,
    pontos: {
      elementos: totalDePontos(p.elementos),
      escolas: totalDePontos(p.escolas),
      recursos: totalDePontos(p.recursos),
      talentos: totalDePontos(p.talentos),
      profissoes: totalDePontos(p.profissoes),
      total:
        totalDePontos(p.elementos) +
        totalDePontos(p.escolas) +
        totalDePontos(p.recursos) +
        totalDePontos(p.talentos) +
        totalDePontos(p.profissoes),
    },
    elementosBase: BASES.filter((id) => (prog.niveisEfetivos[id] ?? 0) > 0).map((id) => ({
      id,
      direto: p.elementos[id] ?? 0,
      transbordo: prog.transbordo[id] ?? 0,
      efetivo: prog.niveisEfetivos[id] ?? 0,
    })),
    derivadosAbertos: ordenados.slice(0, limiteDerivados),
    combinacoesAbertas: prog.combinacoesLiberadas.length,
    arquetipos: prog.arquetipos.map((a) => ({
      id: a.id,
      nome: a.nome,
      capacidades: a.capacidades,
    })),
    arquetiposDiluidos: prog.arquetiposDiluidos.map((a) => ({ id: a.id, nome: a.nome })),
    capacidades: [...prog.capacidades].sort(),
    capacidadesDiluidas: [...prog.capacidadesDiluidas].sort(),
    talentos: (Object.entries(p.talentos) as [TalentoId, number][])
      .filter(([, r]) => r > 0)
      .map(([id, ranks]) => ({ id, nome: TALENTOS[id].nome, ranks, maximo: TALENTOS[id].ranksMaximos }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    avisos,
  };
}

// ---------------------------------------------------------------------------
// 4. Descoberta: o que está a um passo
// ---------------------------------------------------------------------------

export interface CombinacaoProxima {
  id: ElementoId;
  nome: string;
  aridade: number;
  coerencia: string;
  curada: boolean;
  progresso: number;
  /** Pontos DIRETOS que faltam, por elemento base. */
  faltam: Partial<Record<ElementoBaseId, number>>;
  custoTotal: number;
  descricao: string;
}

/**
 * As combinações mais baratas de alcançar a partir desta ficha. É o mecanismo
 * de DESCOBERTA do sistema: com 3.215 elementos, ninguém navega o espaço por
 * enumeração — navega por "o que está perto de mim agora".
 */
export function proximasCombinacoes(
  p: Personagem,
  opcoes: { limite?: number; aridades?: number[]; apenasCuradas?: boolean } = {},
): CombinacaoProxima[] {
  const { limite = 15, aridades = [2, 3, 4], apenasCuradas = false } = opcoes;
  const prog = calcularProgressao(p);
  const reducao = prog.reducaoMinimoReceita;
  const candidatos: CombinacaoProxima[] = [];

  const avaliar = (
    id: ElementoId,
    componentes: { elemento: ElementoBaseId; nivelMinimo: number }[],
    curada: boolean,
    coerencia: string,
  ) => {
    if ((prog.niveisEfetivos[id] ?? 0) > 0) return;
    if (!aridades.includes(componentes.length)) return;
    if (apenasCuradas && !curada) return;
    const faltam: Partial<Record<ElementoBaseId, number>> = {};
    let custo = 0;
    for (const c of componentes) {
      const minimo = Math.max(1, c.nivelMinimo - reducao);
      const falta = minimo - (prog.niveisEfetivos[c.elemento] ?? 0);
      if (falta > 0) {
        faltam[c.elemento] = falta;
        custo += falta;
      }
    }
    if (custo === 0) return; // já deveria estar aberta
    const def = elementoDef(id);
    if (!def) return;
    candidatos.push({
      id,
      nome: def.nome,
      aridade: componentes.length,
      coerencia,
      curada,
      progresso:
        componentes.reduce(
          (s, c) =>
            s + Math.min(1, (prog.niveisEfetivos[c.elemento] ?? 0) / Math.max(1, c.nivelMinimo - reducao)),
          0,
        ) / componentes.length,
      faltam,
      custoTotal: custo,
      descricao: def.descricao,
    });
  };

  for (const def of Object.values(ELEMENTOS)) {
    if (!def.receita || def.receita.length > 4) continue;
    // pares não moram no espaço enumerado, mas a coerência é calculável
    const comps = def.receita.map((c) => c.elemento);
    avaliar(def.id, def.receita, true, ROTULO_COERENCIA[coesaoDe(comps).coerencia]);
  }
  for (const info of TODAS_COMBINACOES) {
    if (ELEMENTOS[info.id]) continue; // já avaliado acima
    avaliar(
      info.id,
      info.componentes.map((elemento) => ({ elemento, nivelMinimo: info.nivelMinimo })),
      info.curada,
      ROTULO_COERENCIA[info.coerencia],
    );
  }

  return [...candidatos]
    .sort(
      (a, b) =>
        a.custoTotal - b.custoTotal ||
        Number(b.curada) - Number(a.curada) ||
        a.aridade - b.aridade ||
        String(a.id).localeCompare(String(b.id)),
    )
    .slice(0, limite);
}

// ---------------------------------------------------------------------------
// 5. Planejamento: o caminho até um arquétipo
// ---------------------------------------------------------------------------

export interface PlanoArquetipo {
  arquetipo: { id: string; nome: string; descricao: string };
  alcancado: boolean;
  /** Pontos diretos por elemento base que a ficha precisa TER no fim. */
  elementos: Partial<Record<ElementoBaseId, number>>;
  escolas: Partial<Record<EscolaId, number>>;
  recursos: Partial<Record<RecursoId, number>>;
  /** O que falta investir a partir da ficha atual. */
  faltam: {
    elementos: Partial<Record<ElementoBaseId, number>>;
    escolas: Partial<Record<EscolaId, number>>;
    recursos: Partial<Record<RecursoId, number>>;
  };
  custoTotal: number;
  capacidades: string[];
  /** true quando o plano foi verificado ponta a ponta pelo motor. */
  verificado: boolean;
}

/**
 * O caminho mais barato desta ficha até um arquétipo, em pontos diretos.
 *
 * O plano é sempre **verificado**: a função monta a ficha resultante, roda a
 * progressão e confirma que o arquétipo realmente destrava. Se não destravar,
 * `verificado` vem false — melhor entregar um plano marcado como não provado
 * do que um número inventado.
 */
export function caminhoParaArquetipo(p: Personagem, arquetipoId: string): PlanoArquetipo | undefined {
  const arq: ArquetipoDef | undefined = ARQUETIPOS[arquetipoId];
  if (!arq) return undefined;
  const progAtual = calcularProgressao(p);
  const alcancado = progAtual.arquetipos.some((a) => a.id === arquetipoId);

  // 1) níveis efetivos exigidos, traduzidos para elementos base
  const alvoEfetivo: Partial<Record<ElementoBaseId, number>> = {};
  for (const [id, nivel] of Object.entries(arq.condicao.elementos ?? {}) as [ElementoId, number][]) {
    requisitosBase(id, nivel, alvoEfetivo);
  }
  // 2) pontos diretos, aproveitando sinergias, nunca abaixo do que já existe
  const elementos = pontosDiretosPara(alvoEfetivo, p.elementos as Partial<Record<ElementoBaseId, number>>);

  const escolas: Partial<Record<EscolaId, number>> = { ...p.escolas };
  for (const [id, n] of Object.entries(arq.condicao.escolas ?? {}) as [EscolaId, number][]) {
    escolas[id] = Math.max(escolas[id] ?? 0, n);
  }
  const recursos: Partial<Record<RecursoId, number>> = { ...p.recursos };
  for (const [id, n] of Object.entries(arq.condicao.recursos ?? {}) as [RecursoId, number][]) {
    recursos[id] = Math.max(recursos[id] ?? 0, n);
  }

  const delta = <K extends string>(
    alvo: Partial<Record<K, number>>,
    atual: Partial<Record<K, number>>,
  ): Partial<Record<K, number>> => {
    const saida: Partial<Record<K, number>> = {};
    for (const k of Object.keys(alvo).sort() as K[]) {
      const d = (alvo[k] ?? 0) - (atual[k] ?? 0);
      if (d > 0) saida[k] = d;
    }
    return saida;
  };

  const faltam = {
    elementos: delta(elementos, p.elementos as Partial<Record<ElementoBaseId, number>>),
    escolas: delta(escolas, p.escolas),
    recursos: delta(recursos, p.recursos),
  };

  // 3) verificação: o plano realmente destrava?
  const teste = fichaCom(elementos, escolas, recursos, p.talentos);
  const verificado = calcularProgressao(teste).arquetipos.some((a) => a.id === arquetipoId);

  return {
    arquetipo: { id: arq.id, nome: arq.nome, descricao: arq.descricao },
    alcancado,
    elementos,
    escolas,
    recursos,
    faltam,
    custoTotal:
      totalDePontos(faltam.elementos) + totalDePontos(faltam.escolas) + totalDePontos(faltam.recursos),
    capacidades: arq.capacidades,
    verificado,
  };
}

/** Os arquétipos mais baratos de alcançar a partir desta ficha. */
export function arquetiposProximos(p: Personagem, limite = 10): PlanoArquetipo[] {
  const planos: PlanoArquetipo[] = [];
  for (const id of Object.keys(ARQUETIPOS).sort()) {
    const plano = caminhoParaArquetipo(p, id);
    if (plano && !plano.alcancado && plano.verificado) planos.push(plano);
  }
  return planos
    .sort((a, b) => a.custoTotal - b.custoTotal || a.arquetipo.id.localeCompare(b.arquetipo.id))
    .slice(0, limite);
}

// ---------------------------------------------------------------------------
// 6. Diagnóstico de skill
// ---------------------------------------------------------------------------

export interface DiagnosticoSkill {
  valida: boolean;
  erros: string[];
  tags: string[];
  limites: {
    energiaMaxima: number;
    tempoConjuracaoMinimo: number;
    raioMaximo: number;
    alcanceMaximo: number;
  };
  slotsModificador: number;
  resultado?: {
    custoTotal: number;
    impactoTotal: number;
    impactoPorAlvo: number;
    alvosEsperados: number;
    eficiencia: number;
    perfil: Record<string, number>;
    estados: string[];
    propriedades: { chave: string; rotulo: string; valor: number }[];
  };
}

/** Valida e calcula uma skill, devolvendo o diagnóstico completo. */
export function diagnosticarSkill(p: Personagem, cfg: SkillConfig): DiagnosticoSkill {
  const prog = calcularProgressao(p);
  const { erros, limites } = validarSkill(p, prog, cfg);
  const base: DiagnosticoSkill = {
    valida: erros.length === 0,
    erros,
    tags: tagsDaSkill(cfg).map((t) => ROTULO_TAG[t]),
    limites: {
      energiaMaxima: limites.energiaMaxima,
      tempoConjuracaoMinimo: limites.tempoConjuracaoMinimo,
      raioMaximo: limites.raioMaximo,
      alcanceMaximo: limites.alcanceMaximo,
    },
    slotsModificador: slotsModificador(p),
  };
  if (erros.length) return base;
  const r = calcularSkill(p, prog, cfg);
  return {
    ...base,
    resultado: {
      custoTotal: r.custoTotal,
      impactoTotal: r.impactoTotal,
      impactoPorAlvo: r.impactoPorAlvo,
      alvosEsperados: r.alvosEsperados,
      eficiencia: r.eficiencia,
      perfil: { ...r.perfil },
      estados: r.estados.map((e) => e.nome),
      propriedades: r.propriedades,
    },
  };
}

export interface ModificadorDisponivel {
  id: ModificadorId;
  nome: string;
  descricao: string;
  multiplicadorCusto: number;
  compativel: boolean;
  motivo?: string;
  exigeTags: string[];
}

/** Quais modificadores cabem nesta skill — e por que os outros não cabem. */
export function modificadoresPara(p: Personagem, cfg: SkillConfig): ModificadorDisponivel[] {
  const tags = tagsDaSkill(cfg);
  return Object.keys(MODIFICADORES)
    .sort()
    .map((id) => {
      const def = MODIFICADORES[id as ModificadorId];
      const av = avaliarModificador(p, cfg, id as ModificadorId, tags);
      return {
        id: def.id,
        nome: def.nome,
        descricao: def.descricao,
        multiplicadorCusto: def.multiplicadorCusto,
        compativel: av.compativel,
        motivo: av.motivo,
        exigeTags: def.exigeTags.map((t) => ROTULO_TAG[t]),
      };
    })
    .sort((a, b) => Number(b.compativel) - Number(a.compativel) || a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------------------
// 7. Fusão
// ---------------------------------------------------------------------------

export interface PreviaFusao {
  geracao: number;
  modo: string;
  descricaoModo: string;
  basesEnvolvidas: string[];
  elementoResultante?: string;
  nomeElementoResultante?: string;
  liberado: boolean;
}

/** O que sairia de fundir estas skills, sem calcular o resultado inteiro. */
export function previaDeFusao(p: Personagem, componentes: SkillConfig[]): PreviaFusao {
  const prog = calcularProgressao(p);
  const pv = previewFusao(prog, componentes);
  return {
    geracao: pv.geracao,
    modo: pv.modo.nome,
    descricaoModo: pv.modo.descricao,
    basesEnvolvidas: pv.bases.map((b) => ELEMENTOS[b].nome),
    elementoResultante: pv.elemento ? String(pv.elemento) : undefined,
    nomeElementoResultante: pv.nome,
    liberado: pv.liberado,
  };
}

export interface DiagnosticoFusao extends PreviaFusao {
  valida: boolean;
  erros: string[];
  avisos: string[];
  custoTotal: number;
  impactoTotal: number;
  impactoSeparado: number;
  custoSeparado: number;
  ganhoDeFusao: number;
  taxaDeCusto: number;
  eficienciaRelativa: number;
  tetoAtingido: boolean;
  propriedadesEmergentes: { chave: string; rotulo: string; valor: number }[];
}

/** Calcula uma fusão completa, com a comparação honesta contra lançar separado. */
export function diagnosticarFusao(p: Personagem, cfg: FusaoConfig): DiagnosticoFusao {
  const prog = calcularProgressao(p);
  const r = calcularFusao(p, prog, cfg);
  return {
    geracao: r.geracao,
    modo: r.modo.nome,
    descricaoModo: r.modo.descricao,
    basesEnvolvidas: r.basesEnvolvidas.map((b) => ELEMENTOS[b].nome),
    elementoResultante: String(r.elementoResultante),
    nomeElementoResultante: r.nomeElementoResultante,
    liberado: true,
    valida: r.valida,
    erros: r.erros,
    avisos: r.avisos,
    custoTotal: r.resultado.custoTotal,
    impactoTotal: r.resultado.impactoTotal,
    impactoSeparado: r.impactoSeparado,
    custoSeparado: r.custoSeparado,
    ganhoDeFusao: r.ganhoDeFusao,
    taxaDeCusto: r.taxaDeCusto,
    eficienciaRelativa: r.taxaDeCusto > 0 ? r.ganhoDeFusao / r.taxaDeCusto : 1,
    tetoAtingido: r.tetoGanhoAtingido,
    propriedadesEmergentes: r.propriedadesEmergentes,
  };
}

// ---------------------------------------------------------------------------
// 8. Busca e explicação
// ---------------------------------------------------------------------------

export type TipoEntidade =
  | 'elemento'
  | 'combinacao'
  | 'escola'
  | 'recurso'
  | 'talento'
  | 'arquetipo'
  | 'profissao'
  | 'modificador'
  | 'item'
  | 'propriedade'
  | 'criatura';

export interface Achado {
  tipo: TipoEntidade;
  id: string;
  nome: string;
  descricao: string;
}

const semAcento = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Busca textual sobre TODO o sistema, de uma vez. */
export function buscar(termo: string, limite = 20): Achado[] {
  const alvo = semAcento(termo.trim());
  if (!alvo) return [];
  const achados: Achado[] = [];
  const push = (tipo: TipoEntidade, id: string, nome: string, descricao: string) => {
    if (semAcento(nome).includes(alvo) || semAcento(id).includes(alvo)) {
      achados.push({ tipo, id, nome, descricao });
    }
  };

  for (const d of Object.values(ELEMENTOS)) push('elemento', d.id, d.nome, d.descricao);
  for (const d of Object.values(ESCOLAS)) push('escola', d.id, d.nome, d.descricao);
  for (const d of Object.values(RECURSOS)) push('recurso', d.id, d.nome, d.descricao ?? '');
  for (const d of Object.values(TALENTOS)) push('talento', d.id, d.nome, d.descricao);
  for (const d of Object.values(ARQUETIPOS)) push('arquetipo', d.id, d.nome, d.descricao);
  for (const d of Object.values(PROFISSOES)) push('profissao', d.id, d.nome, d.descricao);
  for (const d of Object.values(MODIFICADORES)) push('modificador', d.id, d.nome, d.descricao);
  for (const d of Object.values(ITENS_BASE)) push('item', d.id, d.nome, d.descricao);
  for (const d of Object.values(PROPRIEDADES_ITEM)) push('propriedade', d.id, d.nome, d.descricao);
  for (const d of Object.values(CRIATURAS)) push('criatura', d.id, d.nome, d.descricao ?? '');

  if (achados.length < limite) {
    for (const info of buscarCombinacoes(termo, limite)) {
      const def = elementoDef(info.id);
      if (def && !achados.some((a) => a.id === String(info.id))) {
        achados.push({
          tipo: 'combinacao',
          id: String(info.id),
          nome: def.nome,
          descricao: def.descricao,
        });
      }
    }
  }

  return achados
    .sort((a, b) => a.nome.length - b.nome.length || a.id.localeCompare(b.id))
    .slice(0, limite);
}

export interface ExplicacaoElemento {
  id: string;
  nome: string;
  tipo: string;
  aridade: number;
  descricao: string;
  fatorPotencia: number;
  perfil: Record<string, number>;
  receita?: { elemento: string; nome: string; nivelMinimo: number }[];
  coerencia?: string;
  curada?: boolean;
  /** Combinações que usam este elemento e estão a poucos passos. */
  usadoEm: { id: string; nome: string; aridade: number }[];
  requisitosBase: Partial<Record<ElementoBaseId, number>>;
}

/** Tudo que se sabe sobre um elemento — incluindo os procedurais. */
export function explicarElemento(id: ElementoId, limiteUsos = 12): ExplicacaoElemento | undefined {
  const def = elementoDef(id);
  if (!def) return undefined;
  const info = combinacaoInfo(def.id);
  const usadoEm: { id: string; nome: string; aridade: number }[] = [];
  const alvo = new Set<string>(
    def.tipo === 'base' ? [def.id] : (def.receita ?? []).map((r) => r.elemento),
  );
  for (const c of TODAS_COMBINACOES) {
    if (usadoEm.length >= limiteUsos) break;
    if (c.id === def.id) continue;
    const conjunto = new Set<string>(c.componentes);
    if ([...alvo].every((x) => conjunto.has(x))) {
      const d = elementoDef(c.id);
      if (d) usadoEm.push({ id: String(c.id), nome: d.nome, aridade: c.aridade });
    }
  }
  return {
    id: def.id,
    nome: def.nome,
    tipo: def.tipo,
    aridade: def.receita?.length ?? 1,
    descricao: def.descricao,
    fatorPotencia: def.fatorPotencia,
    perfil: { ...def.pesos },
    receita: def.receita?.map((c) => ({
      elemento: c.elemento,
      nome: ELEMENTOS[c.elemento].nome,
      nivelMinimo: c.nivelMinimo,
    })),
    coerencia: def.receita
      ? ROTULO_COERENCIA[coesaoDe(def.receita.map((c) => c.elemento)).coerencia]
      : undefined,
    curada: info ? info.curada : def.tipo !== 'base' ? true : undefined,
    usadoEm,
    requisitosBase: requisitosBase(def.id, def.receita?.[0]?.nivelMinimo ?? 1),
  };
}

// ---------------------------------------------------------------------------
// 9. Integridade do registro
// ---------------------------------------------------------------------------

export interface ProblemaIntegridade {
  severidade: 'erro' | 'aviso';
  tipo: string;
  onde: string;
  mensagem: string;
}

/**
 * Verifica se o conteúdo é internamente consistente: todo id referenciado
 * existe, todo requisito é alcançável, nada ficou órfão. Roda em milissegundos
 * e é a rede de segurança de quem adiciona conteúdo.
 */
export function verificarIntegridade(): ProblemaIntegridade[] {
  const problemas: ProblemaIntegridade[] = [];
  const existe = (id: string) => Boolean(elementoDef(id));

  for (const arq of Object.values(ARQUETIPOS)) {
    for (const id of Object.keys(arq.condicao.elementos ?? {})) {
      if (!existe(id)) {
        problemas.push({
          severidade: 'erro',
          tipo: 'elemento_inexistente',
          onde: `arquetipos.${arq.id}`,
          mensagem: `Exige o elemento "${id}", que não existe no registro.`,
        });
      }
    }
    for (const id of Object.keys(arq.condicao.escolas ?? {})) {
      if (!ESCOLAS[id as EscolaId]) {
        problemas.push({
          severidade: 'erro',
          tipo: 'escola_inexistente',
          onde: `arquetipos.${arq.id}`,
          mensagem: `Exige a escola "${id}", que não existe.`,
        });
      }
    }
    for (const id of Object.keys(arq.condicao.recursos ?? {})) {
      if (!RECURSOS[id as RecursoId]) {
        problemas.push({
          severidade: 'erro',
          tipo: 'recurso_inexistente',
          onde: `arquetipos.${arq.id}`,
          mensagem: `Exige o recurso "${id}", que não existe.`,
        });
      }
    }
    // alcançabilidade: existe alguma ficha que destrava este arquétipo?
    const plano = caminhoParaArquetipo(criarPersonagem('teste'), arq.id);
    if (plano && !plano.verificado) {
      problemas.push({
        severidade: 'erro',
        tipo: 'arquetipo_inalcancavel',
        onde: `arquetipos.${arq.id}`,
        mensagem:
          'Nenhuma distribuição de pontos derivada da condição destrava este arquétipo — ' +
          'a condição é impossível ou depende de algo que a progressão não produz.',
      });
    }
  }

  for (const prop of Object.values(PROPRIEDADES_ITEM)) {
    for (const id of [...(prop.requerTodos ?? []), ...(prop.requerAlgum ?? [])]) {
      if (!existe(String(id))) {
        problemas.push({
          severidade: 'erro',
          tipo: 'elemento_inexistente',
          onde: `propriedades_item.${prop.id}`,
          mensagem: `Exige o elemento "${id}", que não existe no registro.`,
        });
      }
    }
    if (prop.requerTalento && !TALENTOS[prop.requerTalento]) {
      problemas.push({
        severidade: 'erro',
        tipo: 'talento_inexistente',
        onde: `propriedades_item.${prop.id}`,
        mensagem: `Exige o talento "${prop.requerTalento}", que não existe.`,
      });
    }
  }

  for (const prof of Object.values(PROFISSOES)) {
    for (const id of Object.keys(prof.fatoresElementos)) {
      if (!existe(id)) {
        problemas.push({
          severidade: 'erro',
          tipo: 'elemento_inexistente',
          onde: `profissoes.${prof.id}`,
          mensagem: `Escala com o elemento "${id}", que não existe.`,
        });
      }
    }
    if (!Object.values(ITENS_BASE).some((i) => i.profissao === prof.id)) {
      problemas.push({
        severidade: 'aviso',
        tipo: 'profissao_sem_itens',
        onde: `profissoes.${prof.id}`,
        mensagem: 'Nenhum item-base pertence a esta profissão — ela não produz nada.',
      });
    }
  }

  for (const tal of Object.values(TALENTOS)) {
    for (const rival of tal.exclusivoCom ?? []) {
      if (!TALENTOS[rival]) {
        problemas.push({
          severidade: 'erro',
          tipo: 'talento_inexistente',
          onde: `talentos.${tal.id}`,
          mensagem: `É exclusivo com "${rival}", que não existe.`,
        });
      } else if (!(TALENTOS[rival].exclusivoCom ?? []).includes(tal.id)) {
        problemas.push({
          severidade: 'aviso',
          tipo: 'exclusividade_assimetrica',
          onde: `talentos.${tal.id}`,
          mensagem: `Declara exclusividade com "${rival}", mas "${rival}" não retribui.`,
        });
      }
    }
    if (tal.requisito?.escola && !ESCOLAS[tal.requisito.escola]) {
      problemas.push({
        severidade: 'erro',
        tipo: 'escola_inexistente',
        onde: `talentos.${tal.id}`,
        mensagem: `Exige a escola "${tal.requisito.escola}", que não existe.`,
      });
    }
  }

  for (const mod of Object.values(MODIFICADORES)) {
    if (mod.requisito?.escola && !ESCOLAS[mod.requisito.escola]) {
      problemas.push({
        severidade: 'erro',
        tipo: 'escola_inexistente',
        onde: `modificadores.${mod.id}`,
        mensagem: `Exige a escola "${mod.requisito.escola}", que não existe.`,
      });
    }
    if (mod.requisito?.talento && !TALENTOS[mod.requisito.talento]) {
      problemas.push({
        severidade: 'erro',
        tipo: 'talento_inexistente',
        onde: `modificadores.${mod.id}`,
        mensagem: `Exige o talento "${mod.requisito.talento}", que não existe.`,
      });
    }
    const impossivel = (mod.proibeTags ?? []).some((t) => mod.exigeTags.includes(t));
    if (impossivel) {
      problemas.push({
        severidade: 'erro',
        tipo: 'modificador_impossivel',
        onde: `modificadores.${mod.id}`,
        mensagem: 'Exige e proíbe a mesma tag — nenhuma skill jamais o aceita.',
      });
    }
  }

  return problemas.sort(
    (a, b) =>
      (a.severidade === b.severidade ? 0 : a.severidade === 'erro' ? -1 : 1) ||
      a.onde.localeCompare(b.onde),
  );
}

// ---------------------------------------------------------------------------
// 10. Catálogos (listagens paginadas e determinísticas)
// ---------------------------------------------------------------------------

export interface Pagina<T> {
  itens: T[];
  total: number;
  restantes: number;
}

function paginar<T>(todos: T[], limite: number, offset: number): Pagina<T> {
  const itens = todos.slice(offset, offset + limite);
  return { itens, total: todos.length, restantes: Math.max(0, todos.length - offset - itens.length) };
}

export function listarArquetipos(limite = 25, offset = 0): Pagina<Achado> {
  const todos = Object.values(ARQUETIPOS)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((d) => ({ tipo: 'arquetipo' as const, id: d.id, nome: d.nome, descricao: d.descricao }));
  return paginar(todos, limite, offset);
}

export function listarTalentos(limite = 25, offset = 0): Pagina<Achado> {
  const todos = Object.values(TALENTOS)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((d) => ({ tipo: 'talento' as const, id: d.id, nome: d.nome, descricao: d.descricao }));
  return paginar(todos, limite, offset);
}

export function listarModificadores(limite = 25, offset = 0): Pagina<Achado> {
  const todos = Object.values(MODIFICADORES)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((d) => ({ tipo: 'modificador' as const, id: d.id, nome: d.nome, descricao: d.descricao }));
  return paginar(todos, limite, offset);
}

export function listarCombinacoes(
  opcoes: { aridade?: number; apenasCuradas?: boolean; limite?: number; offset?: number } = {},
): Pagina<Achado & { aridade: number; coerencia: string; curada: boolean }> {
  const { aridade, apenasCuradas = false, limite = 25, offset = 0 } = opcoes;
  const filtradas = TODAS_COMBINACOES.filter(
    (c: CombinacaoInfo) =>
      (aridade === undefined || c.aridade === aridade) && (!apenasCuradas || c.curada),
  ).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const todos = filtradas.map((c) => {
    const def = elementoDef(c.id)!;
    return {
      tipo: 'combinacao' as const,
      id: String(c.id),
      nome: def.nome,
      descricao: def.descricao,
      aridade: c.aridade,
      coerencia: ROTULO_COERENCIA[c.coerencia],
      curada: c.curada,
    };
  });
  return paginar(todos, limite, offset);
}

/** Reexporta o util de chave para consumidores externos montarem consultas. */
export { chaveCombinacao, progressoCombinacao };
