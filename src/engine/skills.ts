/**
 * Construtor + calculadora de skills.
 *
 * O jogador monta a skill escolhendo: elemento, escola, FONTES DE ENERGIA
 * (uma ou mais, em proporções livres), energia investida, tempo de
 * conjuração, alcance, área e forma de entrega. O motor valida contra a
 * progressão e calcula custo e impacto em tempo real.
 *
 * FONTES DE ENERGIA — uma skill pode misturar recursos (ex.: 60% mana +
 * 40% fúria), desde que o personagem tenha proficiência (pontos) em cada
 * fonte usada. A proficiência ponderada pelas proporções escala tudo:
 *   - custo menor (−1%/ponto, até −30%);
 *   - impacto maior (+0.8%/ponto);
 *   - tempo mínimo de conjuração menor (−0.01s/ponto).
 *
 * BALANCEAMENTO — a regra central é um orçamento único de poder:
 *
 *   orcamento = energia × multTempo × multNivel × multFoco × multFontes
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
import { CRIATURAS } from '../registry/criaturas';
import { bonusVinculo, MAESTRIA_LIMIAR, type ModoEvocacao } from './evocacao';
import type { Personagem } from './personagem';
import type { Progressao } from './progressao';

/**
 * Fonte da evocação, usada só em skills de escola Evocação:
 *  - elemental: um elemental do próprio elemento da skill (padrão).
 *  - aleatoria: criatura qualquer; escala com Evocação, sem preparo.
 *  - capturada: uma criatura do bestiário, imbuída do elemento da skill.
 */
export interface EvocacaoSkill {
  modo: ModoEvocacao;
  criaturaId?: string;
}

export type AreaConfig =
  | { tipo: 'unico' }
  | { tipo: 'circulo'; raioMetros: number };

export type EntregaConfig =
  | { tipo: 'instantaneo' }
  | { tipo: 'continuo'; duracaoSegundos: number };

/** Uma fonte de energia da skill; proporções são relativas (normalizadas). */
export interface FonteEnergia {
  recurso: RecursoId;
  proporcao: number;
}

export interface SkillConfig {
  nome: string;
  elemento: ElementoId;
  escola: EscolaId;
  /** Fontes de energia combinadas em proporções livres. */
  fontes: FonteEnergia[];
  /** Quanto de energia é investido; mais energia = mais resultado. */
  energia: number;
  /** Mais tempo de conjuração = mais resultado. */
  tempoConjuracaoSegundos: number;
  /** Distância de lançamento; limitada por talentos, encarece de leve. */
  alcanceMetros: number;
  area: AreaConfig;
  entrega: EntregaConfig;
  /** Capacidade de arquétipo exigida (ex.: 'evocar_demonios_mortos'). */
  capacidadeExigida?: string;
  /** Fonte da evocação (só relevante em escola Evocação; padrão: elemental). */
  evocacao?: EvocacaoSkill;
}

export interface LimitesSkill {
  energiaMaxima: number;
  tempoConjuracaoMinimo: number;
  raioMaximo: number;
  alcanceMaximo: number;
}

export interface ResultadoSkill {
  valida: boolean;
  erros: string[];
  limites: LimitesSkill;
  /** Custo total (antes das dinâmicas de fé/ressonância em tempo real). */
  custoTotal: number;
  /** Quanto do custo cada fonte paga, na proporção escolhida. */
  custoPorFonte: { recurso: RecursoId; custo: number }[];
  /** Proficiência ponderada pelas proporções das fontes. */
  proficienciaPonderada: number;
  orcamentoDePoder: number;
  alvosEsperados: number;
  /** Impacto total esperado somando todos os alvos/duração. */
  impactoTotal: number;
  impactoPorAlvo: number;
  /** Presente quando entrega é contínua. */
  impactoPorSegundo?: number;
  /** Presente quando a escola é evocação. */
  invocacoes?: {
    quantidade: number;
    poderPorCriatura: number;
    poderTotal: number;
    nome: string;
    familia?: string;
    imbuida: boolean;
  };
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
const ALCANCE_MAXIMO_BASE = 20;
const CUSTO_EXTRA_POR_METRO_ALCANCE = 0.005;
const DENSIDADE_ALVOS_POR_M2 = 0.15;
const EFICIENCIA_AREA = 0.9; // leve taxa por espalhar o orçamento
const BONUS_POR_NIVEL_ELEMENTO = 0.04;
const BONUS_POR_NIVEL_ESCOLA = 0.03;
const BONUS_TOTAL_DOT_MAXIMO = 0.3;
const EXPOENTE_DIVISAO_ENXAME = 0.9;
// escala por proficiência na fonte de energia
const REDUCAO_CUSTO_POR_PROFICIENCIA = 0.01;
const REDUCAO_CUSTO_MAXIMA = 0.3;
const BONUS_IMPACTO_POR_PROFICIENCIA = 0.008;
const REDUCAO_TEMPO_POR_PROFICIENCIA = 0.01;
// evocação: fator da fonte sobre o poder da invocação
const FONTE_ALEATORIA_FATOR = 0.9;
const RAREZA_TETO = 0.4; // bônus máx. de raridade da criatura capturada
const RAREZA_DIVISOR = 250; // poderBase/divisor → bônus de raridade

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

/** Filtra proporções > 0, funde duplicatas e normaliza para somar 1. */
export function normalizarFontes(fontes: FonteEnergia[]): FonteEnergia[] {
  const porRecurso = new Map<RecursoId, number>();
  for (const f of fontes) {
    if (f.proporcao > 0) porRecurso.set(f.recurso, (porRecurso.get(f.recurso) ?? 0) + f.proporcao);
  }
  const soma = [...porRecurso.values()].reduce((a, b) => a + b, 0);
  if (soma <= 0) return [];
  return [...porRecurso.entries()].map(([recurso, proporcao]) => ({
    recurso,
    proporcao: proporcao / soma,
  }));
}

/** Proficiência do personagem ponderada pelas proporções das fontes. */
export function proficienciaPonderada(p: Personagem, fontes: FonteEnergia[]): number {
  const norm = normalizarFontes(fontes);
  return norm.reduce((s, f) => s + f.proporcao * (p.recursos[f.recurso] ?? 0), 0);
}

export function calcularLimites(
  p: Personagem,
  escola: EscolaId,
  fontes: FonteEnergia[] = [],
): LimitesSkill {
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
  const bonusAlcance = somaEfeitos(p, (e, r) =>
    e.tipo === 'alcance_bonus_metros' ? e.valorPorRank * r : 0,
  );
  const prof = proficienciaPonderada(p, fontes);
  return {
    energiaMaxima:
      (ENERGIA_MAX_BASE + ENERGIA_MAX_POR_NIVEL_ESCOLA * nivelEscola) * (1 + bonusEnergia),
    tempoConjuracaoMinimo: Math.max(
      TEMPO_MINIMO_PISO,
      TEMPO_MINIMO_BASE - reducaoTempo - REDUCAO_TEMPO_POR_PROFICIENCIA * prof,
    ),
    raioMaximo: RAIO_MAXIMO_BASE + bonusRaio,
    alcanceMaximo: ALCANCE_MAXIMO_BASE + bonusAlcance,
  };
}

export function validarSkill(
  p: Personagem,
  prog: Progressao,
  cfg: SkillConfig,
): { erros: string[]; limites: LimitesSkill } {
  const erros: string[] = [];
  const limites = calcularLimites(p, cfg.escola, cfg.fontes);

  if (prog.niveisEfetivos[cfg.elemento] <= 0) {
    erros.push(`Elemento "${ELEMENTOS[cfg.elemento].nome}" ainda não foi liberado.`);
  }
  if ((p.escolas[cfg.escola] ?? 0) <= 0) {
    erros.push(`Sem pontos na escola "${ESCOLAS[cfg.escola].nome}".`);
  }

  const fontesAtivas = normalizarFontes(cfg.fontes);
  if (fontesAtivas.length === 0) {
    erros.push('A skill precisa de pelo menos uma fonte de energia com proporção maior que zero.');
  }
  for (const f of fontesAtivas) {
    if ((p.recursos[f.recurso] ?? 0) <= 0) {
      erros.push(
        `Sem proficiência em ${RECURSOS[f.recurso].nome} — invista pontos nesse recurso para usá-lo como fonte.`,
      );
    }
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
        `(talento Conjuração Rápida e proficiência nas fontes reduzem).`,
    );
  }
  if (cfg.alcanceMetros < 0) erros.push('Alcance não pode ser negativo.');
  if (cfg.alcanceMetros > limites.alcanceMaximo) {
    erros.push(
      `Alcance ${cfg.alcanceMetros}m acima do máximo ${limites.alcanceMaximo}m ` +
        `(talento Alcance Estendido aumenta).`,
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
  // fonte da evocação (só em escola de invocação)
  if (ESCOLAS[cfg.escola].entregaPadrao === 'invocacao' && cfg.evocacao?.modo === 'capturada') {
    const cri = cfg.evocacao.criaturaId ? CRIATURAS[cfg.evocacao.criaturaId] : undefined;
    if (!cri) {
      erros.push('Selecione uma criatura capturada para a evocação.');
    } else if (!p.bestiario.some((b) => b.criaturaId === cri.id)) {
      erros.push(`"${cri.nome}" não está no seu bestiário — capture-a antes de evocá-la.`);
    }
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
  const fatorPotencia = ELEMENTOS[cfg.elemento]?.fatorPotencia ?? 1;

  const fontes = normalizarFontes(cfg.fontes);
  const prof = proficienciaPonderada(p, cfg.fontes);

  // custo: energia − reduções de talento − proficiência + taxa de alcance
  const reducaoTalento = somaEfeitos(p, (e, r) =>
    e.tipo === 'custo_reducao_fracao' ? e.valorPorRank * r : 0,
  );
  const reducaoProf = Math.min(REDUCAO_CUSTO_MAXIMA, REDUCAO_CUSTO_POR_PROFICIENCIA * prof);
  const custoTotal =
    cfg.energia *
    Math.max(0.5, 1 - reducaoTalento) *
    (1 - reducaoProf) *
    (1 + CUSTO_EXTRA_POR_METRO_ALCANCE * cfg.alcanceMetros);
  const custoPorFonte = fontes.map((f) => ({
    recurso: f.recurso,
    custo: custoTotal * f.proporcao,
  }));

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
  // fontes "caras" (soullink paga em vida) amplificam o poder, na proporção
  const multFontes = fontes.length
    ? fontes.reduce(
        (s, f) => s + f.proporcao * (RECURSOS[f.recurso].parametros.multiplicadorPoder ?? 1),
        0,
      )
    : 1;
  const multProficiencia = 1 + BONUS_IMPACTO_POR_PROFICIENCIA * prof;
  const orcamento =
    cfg.energia * multTempo * multNivel * (1 + bonusFoco) * multFontes * multProficiencia;

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

    // fonte da evocação: define quem é invocado e um fator sobre o poder
    const modo = cfg.evocacao?.modo ?? 'elemental';
    const nomeElemento = ELEMENTOS[cfg.elemento]?.nome ?? cfg.elemento;
    let fatorFonte = 1;
    let nomeCriatura = `Elemental de ${nomeElemento}`;
    let familia: string | undefined = 'elemental';
    let imbuida = false;
    if (modo === 'aleatoria') {
      fatorFonte = FONTE_ALEATORIA_FATOR;
      nomeCriatura = 'Criatura Aleatória';
      familia = 'aleatoria';
    } else if (modo === 'capturada' && cfg.evocacao?.criaturaId) {
      const cri = CRIATURAS[cfg.evocacao.criaturaId];
      const bond = p.bestiario.find((b) => b.criaturaId === cri?.id)?.nivelVinculo ?? 0;
      if (cri) {
        const rareza = Math.min(RAREZA_TETO, cri.poderBase / RAREZA_DIVISOR);
        fatorFonte = 1 + rareza + bonusVinculo(p, bond);
        // imbuída pelo elemento da skill quando há maestria naquele elemento
        imbuida = nivelElemento >= MAESTRIA_LIMIAR;
        nomeCriatura = imbuida ? `${cri.nome} de ${nomeElemento}` : cri.nome;
        familia = cri.familia;
      }
    }

    const poderTotal = impactoTotal * (1 + potenciaBonus) * fatorFonte;
    const poderPorCriatura = poderTotal / quantidade ** EXPOENTE_DIVISAO_ENXAME;
    invocacoes = {
      quantidade,
      poderPorCriatura,
      poderTotal: poderPorCriatura * quantidade ** EXPOENTE_DIVISAO_ENXAME,
      nome: nomeCriatura,
      familia,
      imbuida,
    };
  }

  // perfil mecânico: média dos pesos do elemento e da escola × impacto
  const pesosElemento = ELEMENTOS[cfg.elemento]?.pesos ?? {
    dano: 1,
    controle: 0,
    cura: 0,
    defesa: 0,
    suporte: 0,
  };
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

  // notas da dinâmica das fontes escolhidas
  for (const f of fontes) {
    const par = RECURSOS[f.recurso].parametros;
    if (f.recurso === 'soullink') {
      propriedades.push({
        chave: 'custo_em_vida',
        rotulo: `${Math.round(f.proporcao * 100)}% do custo pago com a própria vida (poder amplificado)`,
        valor: (par.multiplicadorPoder ?? 1) - 1,
      });
    }
    if (f.recurso === 'ressonancia') {
      propriedades.push({
        chave: 'ressonancia_maxima',
        rotulo: 'Poder extra com ressonância no máximo',
        valor: (par.multiplicadorPoderMaximo ?? 1) - 1,
      });
    }
  }
  if (prof > 0) {
    propriedades.push({
      chave: 'proficiencia_fontes',
      rotulo: `Proficiência ponderada ${prof.toFixed(1)}: custo −${Math.round(reducaoProf * 100)}%, impacto +${Math.round((multProficiencia - 1) * 100)}%`,
      valor: prof,
    });
  }

  return {
    valida: erros.length === 0,
    erros,
    limites,
    custoTotal,
    custoPorFonte,
    proficienciaPonderada: prof,
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
