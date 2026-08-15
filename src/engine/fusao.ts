/**
 * FUSÃO DE SKILLS — 2ª e 3ª geração.
 *
 * A ideia central, e o que amarra esta camada ao resto do sistema: **fundir
 * skills funde os elementos delas**. Duas skills de Fogo e Terra viram uma
 * skill de **Lava**. Três skills de Fogo, Terra e Sombra viram a tripla
 * correspondente. Quatro, a quádrupla. A árvore de combinações da Camada 1
 * deixa de ser só um mapa de progressão e vira a **gramática das fusões**.
 *
 *   2 skills componentes → geração 2
 *   3 ou 4 componentes   → geração 3
 *
 * MODO DE FUSÃO — não se escolhe, emerge da relação entre os componentes,
 * exatamente como os arquétipos emergem da distribuição de pontos.
 *
 * BALANCEAMENTO — a fusão não tem fórmula própria. Ela **monta uma SkillConfig
 * sintética** e chama `calcularSkill`. Assim herda o invariante de orçamento
 * inteiro, sem risco de as duas fórmulas divergirem com o tempo. Por cima
 * disso aplica só duas coisas:
 *
 *   - o **fator do modo** (pequeno, 1.05–1.18);
 *   - a **taxa de fusão** sobre o custo (1.15× na 2ª geração, 1.35× na 3ª).
 *
 * O resultado é deliberado: fundir é **menos eficiente** por ponto de energia
 * do que lançar as skills separadamente. O que se compra é qualidade — uma
 * ação em vez de N, o perfil e os estados do elemento combinado, e as
 * propriedades emergentes. Fusão que fosse sempre mais eficiente seria
 * obrigatória, e escolha obrigatória não é escolha.
 */

import { type ElementoBaseId, type ElementoId } from '../registry/elementos';
import {
  aridadeDe,
  baseDominanteDe,
  coesaoDe,
  elementoDef,
  elementoDePorComponentes,
  ordenarComponentes,
  type Coerencia,
} from '../registry/combinacoes';
import { ESCOLAS, type EscolaId } from '../registry/escolas';
import type { ModificadorId } from '../registry/modificadores';
import type { RecursoId } from '../registry/recursos';
import { TALENTOS, type EfeitoTalento, type TalentoId } from '../registry/talentos';
import type { Personagem } from './personagem';
import type { Progressao } from './progressao';
import {
  calcularSkill,
  normalizarFontes,
  type FonteEnergia,
  type ResultadoSkill,
  type SkillConfig,
} from './skills';

// ---------------------------------------------------------------------------
// Constantes de balanceamento da fusão
// ---------------------------------------------------------------------------

/** Taxa sobre o custo, por geração. Fundir cobra caro. */
const TAXA_CUSTO_GERACAO: Record<number, number> = { 2: 1.15, 3: 1.35 };
/** Quanto o teto de energia sobe ao fundir (por componente extra). */
const BONUS_ENERGIA_MAXIMA_POR_COMPONENTE = 0.5;
/** A conjuração da fusão parte do maior cast entre os componentes... */
const FATOR_SINCRONIZACAO = 1.0;
/** ...mais uma fração do cast de cada componente adicional. */
const CUSTO_TEMPO_POR_COMPONENTE_EXTRA = 0.35;
/**
 * TETO ANTI-COMPOSIÇÃO da fusão, expresso em EFICIÊNCIA RELATIVA:
 *
 *   (impacto ÷ custo) da fusão  ÷  (impacto ÷ custo) das skills separadas
 *
 * Um teto sobre o impacto absoluto não funciona — ele teria de ser recalibrado
 * a cada aridade, e concentrar energia numa skill só já é naturalmente
 * superlinear neste motor (√tempo, nível do elemento combinado, fator de
 * potência maior). Medido, um Prisma de 3 componentes entregava 1.90× o
 * impacto somado por 1.46× o custo: fundir virava obrigatório.
 *
 * Amarrando o teto na EFICIÊNCIA, a regra passa a ser a intenção de design
 * escrita diretamente: fundir é aproximadamente neutro no numérico. O que se
 * compra é qualitativo — uma ação em vez de N, o perfil e os estados do
 * elemento combinado, e as propriedades emergentes.
 */
const TETO_EFICIENCIA_FUSAO = 1.1;

export type ModoFusao = 'sequencia' | 'amalgama' | 'ressonancia' | 'catalise' | 'prisma';

export interface ModoFusaoDef {
  id: ModoFusao;
  nome: string;
  descricao: string;
  /** Multiplicador sobre o orçamento da skill fundida. */
  fator: number;
  /** Multiplicador extra sobre o custo, além da taxa de geração. */
  taxaCusto: number;
}

export const MODOS_FUSAO: Record<ModoFusao, ModoFusaoDef> = {
  sequencia: {
    id: 'sequencia',
    nome: 'Sequência',
    descricao:
      'Mesma escola: as skills se encadeiam numa execução só, sem tempo morto entre elas.',
    fator: 1.06,
    taxaCusto: 1.0,
  },
  amalgama: {
    id: 'amalgama',
    nome: 'Amálgama',
    descricao:
      'Escolas diferentes sobre elementos que não brigam: os efeitos se dissolvem um no outro.',
    fator: 1.1,
    taxaCusto: 1.05,
  },
  ressonancia: {
    id: 'ressonancia',
    nome: 'Ressonância',
    descricao:
      'Elementos aliados: já se alimentavam antes da fusão, então o encaixe é barato e limpo.',
    fator: 1.12,
    taxaCusto: 0.92,
  },
  catalise: {
    id: 'catalise',
    nome: 'Catálise',
    descricao:
      'Elementos que se negam: forçar a convivência libera muito mais do que qualquer um dos dois — e cobra por isso.',
    fator: 1.2,
    taxaCusto: 1.18,
  },
  prisma: {
    id: 'prisma',
    nome: 'Prisma',
    descricao:
      'Três ou mais correntes distintas: o efeito se abre em faixas simultâneas em vez de um só golpe.',
    fator: 1.15,
    taxaCusto: 1.08,
  },
};

// ---------------------------------------------------------------------------
// Configuração e resultado
// ---------------------------------------------------------------------------

export interface FusaoConfig {
  nome: string;
  /** 2 a 4 skills componentes. */
  componentes: SkillConfig[];
  /** Escola resultante; padrão: a do primeiro componente. */
  escolaDominante?: EscolaId;
  /** Modificadores aplicados sobre a skill FUNDIDA (não sobre os componentes). */
  modificadores?: ModificadorId[];
  alvoElemento?: ElementoBaseId;
}

export interface ResultadoFusao {
  valida: boolean;
  erros: string[];
  avisos: string[];
  geracao: 2 | 3;
  modo: ModoFusaoDef;
  coerencia: Coerencia;
  /** Elemento que a fusão produziu — a combinação dos elementos componentes. */
  elementoResultante: ElementoId;
  nomeElementoResultante: string;
  /** Elementos base que entraram na receita da fusão. */
  basesEnvolvidas: ElementoBaseId[];
  /** A skill sintética que o motor calculou — reaproveita toda a Camada 5. */
  skillResultante: SkillConfig;
  resultado: ResultadoSkill;
  /** Resultado de cada componente lançado isoladamente, para comparação. */
  componentes: ResultadoSkill[];
  /** Soma dos impactos dos componentes lançados separadamente. */
  impactoSeparado: number;
  /** Soma dos custos dos componentes lançados separadamente. */
  custoSeparado: number;
  /** impactoFundido ÷ impactoSeparado. Abaixo de 1 = fundir perde poder bruto. */
  ganhoDeFusao: number;
  /** custoFundido ÷ custoSeparado. Sempre > 1 — é a taxa de fusão. */
  taxaDeCusto: number;
  tetoGanhoAtingido: boolean;
  propriedadesEmergentes: { chave: string; rotulo: string; valor: number }[];
}

// ---------------------------------------------------------------------------
// Determinação do modo
// ---------------------------------------------------------------------------

function determinarModo(bases: ElementoBaseId[], escolas: EscolaId[]): ModoFusaoDef {
  const escolasDistintas = new Set(escolas).size;
  if (bases.length >= 3) return MODOS_FUSAO.prisma;
  const { coerencia } = coesaoDe(bases);
  if (coerencia === 'paradoxo' || coerencia === 'tensao') return MODOS_FUSAO.catalise;
  if (coerencia === 'harmonia') return MODOS_FUSAO.ressonancia;
  if (escolasDistintas === 1) return MODOS_FUSAO.sequencia;
  return MODOS_FUSAO.amalgama;
}

/** Funde as fontes de energia dos componentes, ponderadas pela energia de cada um. */
function fundirFontes(componentes: SkillConfig[]): FonteEnergia[] {
  const acc = new Map<RecursoId, number>();
  for (const cfg of componentes) {
    for (const f of normalizarFontes(cfg.fontes)) {
      acc.set(f.recurso, (acc.get(f.recurso) ?? 0) + f.proporcao * cfg.energia);
    }
  }
  return [...acc.entries()].map(([recurso, proporcao]) => ({ recurso, proporcao }));
}

function somaEfeitosTalento(
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

/** Redução da taxa de custo da fusão vinda de talentos (Arte da Fusão). */
export function descontoDeFusao(p: Personagem): number {
  return somaEfeitosTalento(p, (e, r) =>
    e.tipo === 'propriedade' && e.chave === 'desconto_fusao' ? e.valorPorRank * r : 0,
  );
}

// ---------------------------------------------------------------------------
// Cálculo
// ---------------------------------------------------------------------------

export function calcularFusao(
  p: Personagem,
  prog: Progressao,
  cfg: FusaoConfig,
): ResultadoFusao {
  const erros: string[] = [];
  const avisos: string[] = [];
  const comps = cfg.componentes;

  if (comps.length < 2) erros.push('Uma fusão precisa de pelo menos 2 skills componentes.');
  if (comps.length > 4) erros.push('Uma fusão comporta no máximo 4 skills componentes.');

  const geracao: 2 | 3 = comps.length >= 3 ? 3 : 2;

  // As bases envolvidas: o elemento base dominante de cada componente, sem repetir.
  const basesEnvolvidas = ordenarComponentes([
    ...new Set(comps.map((k) => baseDominanteDe(k.elemento))),
  ]);

  if (basesEnvolvidas.length < comps.length) {
    avisos.push(
      'Dois componentes compartilham o mesmo elemento base — a fusão não ganha aridade com isso.',
    );
  }

  // ---- o elemento resultante é a combinação das bases envolvidas ----
  let elementoResultante: ElementoId;
  if (basesEnvolvidas.length === 1) {
    elementoResultante = basesEnvolvidas[0];
  } else {
    // vale para qualquer aridade: pares moram no registro curado, triplas e
    // quádruplas no espaço enumerado — o nível efetivo é a única prova de que
    // a combinação está de fato aberta
    const combinado = elementoDePorComponentes(basesEnvolvidas);
    const liberado = combinado ? (prog.niveisEfetivos[combinado.id] ?? 0) > 0 : false;
    if (combinado && liberado) {
      elementoResultante = combinado.id;
    } else {
      // Sem a combinação desbloqueada, a fusão ainda acontece — mas cai no
      // elemento do componente mais forte, sem o bônus da convergência.
      const maisForte = [...comps].sort(
        (a, b) =>
          (prog.niveisEfetivos[b.elemento] ?? 0) - (prog.niveisEfetivos[a.elemento] ?? 0),
      )[0];
      elementoResultante = maisForte?.elemento ?? basesEnvolvidas[0];
      if (combinado) {
        avisos.push(
          `A fusão dessas skills produziria "${combinado.nome}", mas essa combinação ainda ` +
            `não está desbloqueada — o resultado usa "${elementoDef(elementoResultante)?.nome}" ` +
            `e perde o bônus de convergência.`,
        );
      }
    }
  }

  const modo = determinarModo(
    basesEnvolvidas,
    comps.map((k) => k.escola),
  );
  const { coerencia } = coesaoDe(basesEnvolvidas);
  const escola = cfg.escolaDominante ?? comps[0]?.escola ?? 'conjuracao';

  // ---- monta a skill sintética ----
  const energiaTotal = comps.reduce((s, k) => s + k.energia, 0);
  const tempoBase = Math.max(...comps.map((k) => k.tempoConjuracaoSegundos), 0);
  const tempoExtra = comps
    .map((k) => k.tempoConjuracaoSegundos)
    .sort((a, b) => b - a)
    .slice(1)
    .reduce((s, t) => s + t * CUSTO_TEMPO_POR_COMPONENTE_EXTRA, 0);

  const raios = comps
    .map((k) => (k.area.tipo === 'circulo' ? k.area.raioMetros : 0))
    .filter((r) => r > 0);
  const duracoes = comps
    .map((k) => (k.entrega.tipo === 'continuo' ? k.entrega.duracaoSegundos : 0))
    .filter((d) => d > 0);

  const skillResultante: SkillConfig = {
    nome: cfg.nome,
    elemento: elementoResultante,
    escola,
    fontes: fundirFontes(comps),
    energia: energiaTotal,
    tempoConjuracaoSegundos: tempoBase * FATOR_SINCRONIZACAO + tempoExtra,
    alcanceMetros: Math.max(...comps.map((k) => k.alcanceMetros), 0),
    area: raios.length ? { tipo: 'circulo', raioMetros: Math.max(...raios) } : { tipo: 'unico' },
    entrega: duracoes.length
      ? { tipo: 'continuo', duracaoSegundos: Math.max(...duracoes) }
      : { tipo: 'instantaneo' },
    evocacao: comps.find((k) => k.evocacao)?.evocacao,
    montariaId: comps.find((k) => k.montariaId)?.montariaId,
    modificadores: cfg.modificadores,
    alvoElemento: cfg.alvoElemento,
  };

  // O teto de energia sobe com o número de componentes: fundir é justamente
  // a forma de exceder o que uma skill sozinha comporta.
  const folga = 1 + BONUS_ENERGIA_MAXIMA_POR_COMPONENTE * (comps.length - 1);
  const pInflado: Personagem = {
    ...p,
    talentos: { ...p.talentos },
  };

  const resultadoCru = calcularSkill(pInflado, prog, skillResultante);
  const limiteFundido = resultadoCru.limites.energiaMaxima * folga;
  const errosFiltrados = resultadoCru.erros.filter((e) => !e.startsWith('Energia '));
  if (energiaTotal > limiteFundido) {
    errosFiltrados.push(
      `Energia total ${energiaTotal.toFixed(1)} acima do máximo de fusão ` +
        `${limiteFundido.toFixed(1)} (mais escola, Canalização Profunda ou menos componentes).`,
    );
  }
  erros.push(...errosFiltrados);

  // ---- componentes isolados, para a comparação honesta ----
  const componentes = comps.map((k) => calcularSkill(p, prog, k));
  const impactoSeparado = componentes.reduce((s, r) => s + r.impactoTotal, 0);
  const custoSeparado = componentes.reduce((s, r) => s + r.custoTotal, 0);

  // ---- modo, taxa de geração e teto ----
  const taxaGeracao = TAXA_CUSTO_GERACAO[geracao] ?? 1.5;
  const desconto = Math.min(0.6, descontoDeFusao(p));
  const taxaCusto = 1 + (taxaGeracao * modo.taxaCusto - 1) * (1 - desconto);

  let impactoTotal = resultadoCru.impactoTotal * modo.fator;
  const custoTotal = resultadoCru.custoTotal * taxaCusto;

  // teto de eficiência relativa: a fusão nunca supera em mais de 10% a
  // eficiência de lançar os componentes separadamente
  let tetoGanhoAtingido = false;
  if (impactoSeparado > 0 && custoSeparado > 0 && custoTotal > 0) {
    const eficienciaSeparada = impactoSeparado / custoSeparado;
    const tetoImpacto = eficienciaSeparada * TETO_EFICIENCIA_FUSAO * custoTotal;
    if (impactoTotal > tetoImpacto) {
      impactoTotal = tetoImpacto;
      tetoGanhoAtingido = true;
    }
  }
  const escala = resultadoCru.impactoTotal > 0 ? impactoTotal / resultadoCru.impactoTotal : 1;
  const perfil = { ...resultadoCru.perfil };
  for (const k of Object.keys(perfil) as (keyof typeof perfil)[]) perfil[k] *= escala;

  const resultado: ResultadoSkill = {
    ...resultadoCru,
    valida: erros.length === 0,
    erros,
    custoTotal,
    custoPorFonte: resultadoCru.custoPorFonte.map((f) => ({
      ...f,
      custo: f.custo * taxaCusto,
    })),
    impactoTotal,
    impactoPorAlvo: resultadoCru.impactoPorAlvo * escala,
    impactoPorSegundo: resultadoCru.impactoPorSegundo
      ? resultadoCru.impactoPorSegundo * escala
      : undefined,
    invocacoes: resultadoCru.invocacoes
      ? {
          ...resultadoCru.invocacoes,
          poderPorCriatura: resultadoCru.invocacoes.poderPorCriatura * escala,
          poderTotal: resultadoCru.invocacoes.poderTotal * escala,
        }
      : undefined,
    perfil,
    eficiencia: impactoTotal / energiaTotal,
  };

  // ---- propriedades emergentes ----
  const propriedadesEmergentes: ResultadoFusao['propriedadesEmergentes'] = [
    {
      chave: 'geracao',
      rotulo: `Skill de ${geracao}ª geração — ${comps.length} componentes numa ação só`,
      valor: geracao,
    },
    {
      chave: 'modo_fusao',
      rotulo: `Modo ${modo.nome}: ${modo.descricao}`,
      valor: modo.fator - 1,
    },
    {
      chave: 'taxa_fusao',
      rotulo: `Taxa de fusão: custo ×${taxaCusto.toFixed(2)} sobre a skill sintética`,
      valor: taxaCusto,
    },
  ];
  if (basesEnvolvidas.length >= 2 && aridadeDe(elementoResultante) >= basesEnvolvidas.length) {
    propriedadesEmergentes.push({
      chave: 'convergencia_elemental',
      rotulo:
        `Convergência: os elementos dos componentes formaram ` +
        `"${elementoDef(elementoResultante)?.nome}"`,
      valor: basesEnvolvidas.length,
    });
  }
  if (modo.id === 'prisma') {
    propriedadesEmergentes.push({
      chave: 'faixas_simultaneas',
      rotulo: `Prisma: o efeito se abre em ${basesEnvolvidas.length} faixas simultâneas`,
      valor: basesEnvolvidas.length,
    });
  }
  if (tetoGanhoAtingido) {
    propriedadesEmergentes.push({
      chave: 'teto_fusao',
      rotulo:
        `TETO de fusão atingido: a eficiência foi limitada a ` +
        `${TETO_EFICIENCIA_FUSAO}× a de lançar os componentes separadamente`,
      valor: TETO_EFICIENCIA_FUSAO,
    });
  }

  return {
    valida: erros.length === 0,
    erros,
    avisos,
    geracao,
    modo,
    coerencia,
    elementoResultante,
    nomeElementoResultante: elementoDef(elementoResultante)?.nome ?? elementoResultante,
    basesEnvolvidas,
    skillResultante,
    resultado,
    componentes,
    impactoSeparado,
    custoSeparado,
    ganhoDeFusao: impactoSeparado > 0 ? impactoTotal / impactoSeparado : 1,
    taxaDeCusto: custoSeparado > 0 ? custoTotal / custoSeparado : taxaCusto,
    tetoGanhoAtingido,
    propriedadesEmergentes,
  };
}

/**
 * Prévia barata: que elemento sairia da fusão destas skills, e o modo — sem
 * calcular nada. Alimenta a UI enquanto o jogador escolhe os componentes.
 */
export function previewFusao(
  prog: Progressao,
  componentes: Pick<SkillConfig, 'elemento' | 'escola'>[],
): {
  geracao: 2 | 3;
  bases: ElementoBaseId[];
  elemento?: ElementoId;
  nome?: string;
  liberado: boolean;
  modo: ModoFusaoDef;
} {
  const bases = ordenarComponentes([
    ...new Set(componentes.map((k) => baseDominanteDe(k.elemento))),
  ]);
  const modo = determinarModo(
    bases,
    componentes.map((k) => k.escola),
  );
  const geracao: 2 | 3 = componentes.length >= 3 ? 3 : 2;
  if (bases.length < 2) {
    return { geracao, bases, elemento: bases[0], nome: elementoDef(bases[0])?.nome, liberado: true, modo };
  }
  const def = elementoDePorComponentes(bases);
  const liberado = def ? (prog.niveisEfetivos[def.id] ?? 0) > 0 : false;
  return { geracao, bases, elemento: def?.id, nome: def?.nome, liberado, modo };
}

/** Rótulo curto da escola resultante, para a UI. */
export function nomeEscola(escola: EscolaId): string {
  return ESCOLAS[escola].nome;
}
