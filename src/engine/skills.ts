/**
 * Construtor + calculadora de skills.
 *
 * O jogador monta a skill escolhendo: elemento, escola, recurso, energia
 * investida, tempo de conjuração, área e forma de entrega. O motor valida
 * contra a progressão (elemento liberado? talento permite esse raio?) e
 * calcula custo e impacto.
 *
 * BALANCEAMENTO — a regra central é um orçamento único de poder:
 *
 *   orcamento = energia × multTempo × multNivel × multFoco
 *
 * Toda escolha de forma (área, entrega, invocações) apenas REDISTRIBUI esse
 * orçamento, nunca o multiplica de graça. Área maior = menos dano por alvo;
 * mais criaturas = criaturas mais fracas; DoT = mais total, porém diluído no
 * tempo. Assim, builds diferentes com o mesmo investimento têm impacto
 * mecânico similar.
 */

import { ELEMENTOS, type ElementoId, type PerfilPesos } from '../registry/elementos';
import { ESCOLAS, type EscolaId } from '../registry/escolas';
import { RECURSOS, type RecursoId } from '../registry/recursos';
import { TALENTOS, type EfeitoTalento, type TalentoId } from '../registry/talentos';
import type { Personagem } from './personagem';
import type { Progressao } from './progressao';

export type AreaConfig =
  | { tipo: 'unico' }
  | { tipo: 'circulo'; raioMetros: number };

export type EntregaConfig =
  | { tipo: 'instantaneo' }
  | { tipo: 'continuo'; duracaoSegundos: number };

export interface SkillConfig {
  nome: string;
  elemento: ElementoId;
  escola: EscolaId;
  recurso: RecursoId;
  /** Quanto do recurso é investido; mais energia = mais resultado. */
  energia: number;
  /** Mais tempo de conjuração = mais resultado. */
  tempoConjuracaoSegundos: number;
  area: AreaConfig;
  entrega: EntregaConfig;
  /** Capacidade de arquétipo exigida (ex.: 'evocar_demonios_mortos'). */
  capacidadeExigida?: string;
}

export interface LimitesSkill {
  energiaMaxima: number;
  tempoConjuracaoMinimo: number;
  raioMaximo: number;
}

export interface ResultadoSkill {
  valida: boolean;
  erros: string[];
  limites: LimitesSkill;
  /** Custo base no recurso (antes de dinâmica de fé/fúria em tempo real). */
  custoBase: number;
  orcamentoDePoder: number;
  alvosEsperados: number;
  /** Impacto total esperado somando todos os alvos/duração. */
  impactoTotal: number;
  impactoPorAlvo: number;
  /** Presente quando entrega é contínua. */
  impactoPorSegundo?: number;
  /** Presente quando a escola é evocação. */
  invocacoes?: { quantidade: number; poderPorCriatura: number; poderTotal: number };
  /**
   * Como o impacto se distribui mecanicamente — média dos perfis do
   * elemento e da escola aplicada ao impacto total.
   */
  perfil: PerfilPesos;
  /** Propriedades qualitativas vindas de talentos (penetração, contágio...). */
  propriedades: { chave: string; rotulo: string; valor: number }[];
  /** Métrica de balanceamento: impacto total ÷ energia investida. */
  eficiencia: number;
}

// ---- constantes de balanceamento (ajuste fino em um lugar só) ----
const ENERGIA_MAX_BASE = 40;
const ENERGIA_MAX_POR_NIVEL_ESCOLA = 2;
const TEMPO_MINIMO_BASE = 0.5;
const TEMPO_MINIMO_PISO = 0.1;
const RAIO_MAXIMO_BASE = 4;
const DENSIDADE_ALVOS_POR_M2 = 0.15;
const EFICIENCIA_AREA = 0.9; // leve taxa por espalhar o orçamento
const BONUS_POR_NIVEL_ELEMENTO = 0.04;
const BONUS_POR_NIVEL_ESCOLA = 0.03;
const BONUS_TOTAL_DOT_MAXIMO = 0.3;
const EXPOENTE_DIVISAO_ENXAME = 0.9;

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

export function calcularLimites(p: Personagem, escola: EscolaId): LimitesSkill {
  const nivelEscola = p.escolas[escola] ?? 0;
  const bonusEnergia = somaEfeitos(p, (e, r) =>
    e.tipo === 'energia_maxima_bonus_fracao' ? e.valorPorRank * r : 0,
  );
  const reducaoTempo = somaEfeitos(p, (e, r) =>
    e.tipo === 'tempo_conjuracao_minimo_reducao' ? e.valorPorRank * r : 0,
  );
  const bonusRaio = somaEfeitos(p, (e, r) =>
    e.tipo === 'raio_maximo_bonus' ? e.valorPorRank * r : 0,
  );
  return {
    energiaMaxima:
      (ENERGIA_MAX_BASE + ENERGIA_MAX_POR_NIVEL_ESCOLA * nivelEscola) * (1 + bonusEnergia),
    tempoConjuracaoMinimo: Math.max(TEMPO_MINIMO_PISO, TEMPO_MINIMO_BASE - reducaoTempo),
    raioMaximo: RAIO_MAXIMO_BASE + bonusRaio,
  };
}

export function validarSkill(
  p: Personagem,
  prog: Progressao,
  cfg: SkillConfig,
): { erros: string[]; limites: LimitesSkill } {
  const erros: string[] = [];
  const limites = calcularLimites(p, cfg.escola);

  if (prog.niveisEfetivos[cfg.elemento] <= 0) {
    erros.push(`Elemento "${ELEMENTOS[cfg.elemento].nome}" ainda não foi liberado.`);
  }
  if ((p.escolas[cfg.escola] ?? 0) <= 0) {
    erros.push(`Sem pontos na escola "${ESCOLAS[cfg.escola].nome}".`);
  }
  if (cfg.energia <= 0) erros.push('Energia deve ser positiva.');
  if (cfg.energia > limites.energiaMaxima) {
    erros.push(
      `Energia ${cfg.energia} acima do máximo ${limites.energiaMaxima.toFixed(1)} ` +
        `(suba a escola ou o talento Canalização Profunda).`,
    );
  }
  if (cfg.tempoConjuracaoSegundos < limites.tempoConjuracaoMinimo) {
    erros.push(
      `Tempo de conjuração mínimo é ${limites.tempoConjuracaoMinimo.toFixed(2)}s ` +
        `(talento Conjuração Rápida reduz).`,
    );
  }
  if (cfg.area.tipo === 'circulo') {
    if (cfg.area.raioMetros <= 0) erros.push('Raio deve ser positivo.');
    if (cfg.area.raioMetros > limites.raioMaximo) {
      erros.push(
        `Raio ${cfg.area.raioMetros}m acima do máximo ${limites.raioMaximo}m ` +
          `(talento Área Ampliada aumenta).`,
      );
    }
  }
  if (cfg.entrega.tipo === 'continuo' && cfg.entrega.duracaoSegundos <= 0) {
    erros.push('Duração do efeito contínuo deve ser positiva.');
  }
  if (cfg.capacidadeExigida && !prog.capacidades.has(cfg.capacidadeExigida)) {
    erros.push(
      `Exige a capacidade "${cfg.capacidadeExigida}" — desbloqueie o arquétipo correspondente.`,
    );
  }
  return { erros, limites };
}

export function calcularSkill(
  p: Personagem,
  prog: Progressao,
  cfg: SkillConfig,
): ResultadoSkill {
  const { erros, limites } = validarSkill(p, prog, cfg);

  const nivelElemento = prog.niveisEfetivos[cfg.elemento];
  const nivelEscola = p.escolas[cfg.escola] ?? 0;
  const fatorPotencia = ELEMENTOS[cfg.elemento].fatorPotencia;

  // custo: energia menos reduções de talento
  const reducaoCusto = somaEfeitos(p, (e, r) =>
    e.tipo === 'custo_reducao_fracao' ? e.valorPorRank * r : 0,
  );
  const custoBase = cfg.energia * Math.max(0.5, 1 - reducaoCusto);

  // orçamento único de poder
  const tempo = Math.max(cfg.tempoConjuracaoSegundos, limites.tempoConjuracaoMinimo);
  const multTempo = Math.sqrt(tempo); // 1s = 1.0; 4s = 2.0
  const multNivel =
    fatorPotencia *
    (1 + BONUS_POR_NIVEL_ELEMENTO * nivelElemento) *
    (1 + BONUS_POR_NIVEL_ESCOLA * nivelEscola);
  const bonusFoco = somaEfeitos(p, (e, r) =>
    e.tipo === 'foco_entrega' && e.entrega === cfg.entrega.tipo
      ? e.bonusFracaoPorRank * r
      : 0,
  );
  // recursos com custo "caro" (soullink paga em vida) amplificam o poder
  const multRecurso = RECURSOS[cfg.recurso].parametros.multiplicadorPoder ?? 1;
  const orcamento = cfg.energia * multTempo * multNivel * (1 + bonusFoco) * multRecurso;

  // área: espalhar o orçamento entre alvos esperados
  const alvosEsperados =
    cfg.area.tipo === 'unico'
      ? 1
      : Math.max(1, 1 + DENSIDADE_ALVOS_POR_M2 * Math.PI * cfg.area.raioMetros ** 2);
  const eficienciaArea = cfg.area.tipo === 'unico' ? 1 : EFICIENCIA_AREA;

  // entrega: DoT rende um pouco mais no total, mas diluído na duração
  let impactoTotal = orcamento * eficienciaArea;
  let impactoPorSegundo: number | undefined;
  if (cfg.entrega.tipo === 'continuo') {
    const bonusDot = Math.min(
      BONUS_TOTAL_DOT_MAXIMO,
      0.02 * cfg.entrega.duracaoSegundos,
    );
    impactoTotal *= 1 + bonusDot;
    impactoPorSegundo = impactoTotal / cfg.entrega.duracaoSegundos;
  }

  const impactoPorAlvo = impactoTotal / alvosEsperados;

  // evocação: orçamento vira criaturas
  let invocacoes: ResultadoSkill['invocacoes'];
  if (ESCOLAS[cfg.escola].entregaPadrao === 'invocacao') {
    const quantidadeBonus = somaEfeitos(p, (e, r) =>
      e.tipo === 'invocacao_quantidade_bonus' ? e.valorPorRank * r : 0,
    );
    const potenciaBonus = somaEfeitos(p, (e, r) =>
      e.tipo === 'invocacao_potencia_bonus_fracao' ? e.valorPorRank * r : 0,
    );
    const quantidade = 1 + Math.floor(quantidadeBonus);
    const poderTotal = impactoTotal * (1 + potenciaBonus);
    const poderPorCriatura = poderTotal / quantidade ** EXPOENTE_DIVISAO_ENXAME;
    invocacoes = {
      quantidade,
      poderPorCriatura,
      poderTotal: poderPorCriatura * quantidade ** EXPOENTE_DIVISAO_ENXAME,
    };
  }

  // perfil mecânico: média dos pesos do elemento e da escola × impacto
  const pesosElemento = ELEMENTOS[cfg.elemento]!.pesos;
  const pesosEscola = ESCOLAS[cfg.escola].pesos;
  const perfil = {} as PerfilPesos;
  for (const k of ['dano', 'controle', 'cura', 'defesa', 'suporte'] as const) {
    perfil[k] = ((pesosElemento[k] + pesosEscola[k]) / 2) * impactoTotal;
  }

  // propriedades qualitativas de talentos (gerais ou da escola da skill)
  const propriedades: ResultadoSkill['propriedades'] = [];
  for (const [id, ranks] of Object.entries(p.talentos) as [TalentoId, number][]) {
    if (!ranks) continue;
    for (const efeito of TALENTOS[id].efeitos) {
      if (efeito.tipo !== 'propriedade') continue;
      if (efeito.escola && efeito.escola !== cfg.escola) continue;
      propriedades.push({
        chave: efeito.chave,
        rotulo: efeito.rotulo,
        valor: efeito.valorPorRank * ranks,
      });
    }
  }

  // notas da dinâmica do recurso escolhido
  const parRecurso = RECURSOS[cfg.recurso].parametros;
  if (cfg.recurso === 'soullink') {
    propriedades.push({
      chave: 'custo_em_vida',
      rotulo: 'Custo pago com a própria vida (poder amplificado)',
      valor: (parRecurso.multiplicadorPoder ?? 1) - 1,
    });
  }
  if (cfg.recurso === 'ressonancia') {
    propriedades.push({
      chave: 'ressonancia_maxima',
      rotulo: 'Poder extra com ressonância no máximo',
      valor: (parRecurso.multiplicadorPoderMaximo ?? 1) - 1,
    });
  }

  return {
    valida: erros.length === 0,
    erros,
    limites,
    custoBase,
    orcamentoDePoder: orcamento,
    alvosEsperados,
    impactoTotal,
    impactoPorAlvo,
    impactoPorSegundo,
    invocacoes,
    perfil,
    propriedades,
    eficiencia: impactoTotal / cfg.energia,
  };
}
