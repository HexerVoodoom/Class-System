/**
 * Motor de Evocação: captura, doma e os três modos de evocar.
 *
 * MODOS
 *  - elemental: evocação básica de um elemento com nível — invoca um
 *    elemental. Sempre disponível, não precisa capturar nada.
 *  - aleatoria: invoca uma criatura qualquer; quanto mais pontos em
 *    Evocação, mais poderosa. Sempre disponível.
 *  - capturada: invoca uma criatura previamente capturada, opcionalmente
 *    IMBUÍDA de um elemento no qual o jogador tem maestria.
 *
 * CAPTURA depende da afinidade elemental: só se captura criatura cujo
 * elemento de afinidade o jogador possui (com pontos). O poder de captura
 * escala com o nível nesse elemento, com Evocação e com o talento de caça.
 *
 * DOMA é o vínculo permanente: criaturas vinculadas ganham bônus e evoluem
 * com o nível de vínculo. A capacidade de vínculo vem dos talentos de Doma.
 */

import { ELEMENTOS, elementosBase, type ElementoBaseId, type ElementoId } from '../registry/elementos';
import { CRIATURAS, type CriaturaDef } from '../registry/criaturas';
import type { Personagem } from './personagem';
import type { Progressao } from './progressao';

export type ModoEvocacao = 'elemental' | 'aleatoria' | 'capturada';

// ---- constantes de balanceamento ----
export const MAESTRIA_LIMIAR = 8; // nível efetivo p/ imbuir um elemento
const CAPTURA_BASE = 8;
const CAPTURA_POR_NIVEL_ELEMENTO = 4;
const CAPTURA_POR_EVOCACAO = 3;
const CAPTURA_BONUS_INSTINTO = 0.15; // por rank de instinto_de_caca
const EVOC_ESCALA = 0.05; // +5% de poder por ponto de evocação
const ELEMENTAL_BASE = 10;
const ELEMENTAL_POR_NIVEL = 4;
const ALEATORIA_BASE = 8;
const ALEATORIA_POR_EVOCACAO = 6;
const IMBUIR_POR_NIVEL = 0.03; // +3% por nível do elemento imbuído
const VINCULO_POR_NIVEL = 0.08; // +8% de poder por nível de vínculo
const ALFA_BONUS = 0.12; // por rank de fera_alfa

const talento = (p: Personagem, id: string) => p.talentos[id as keyof typeof p.talentos] ?? 0;

/** Elementos (base ou derivados) com nível efetivo suficiente para imbuir. */
export function elementosDeMaestria(prog: Progressao, limiar = MAESTRIA_LIMIAR): ElementoId[] {
  return (Object.keys(prog.niveisEfetivos) as ElementoId[]).filter(
    (id) => (prog.niveisEfetivos[id] ?? 0) >= limiar,
  );
}

/** Poder de captura do jogador contra uma criatura (0 se não tem afinidade). */
export function poderCaptura(p: Personagem, prog: Progressao, criatura: CriaturaDef): number {
  const nivelAfinidade = Math.max(
    0,
    ...criatura.afinidades.map((e) => p.elementos[e] ?? 0), // pontos DIRETOS no elemento de afinidade
  );
  if (nivelAfinidade <= 0) return 0;
  const evocacao = p.escolas.evocacao ?? 0;
  const instinto = talento(p, 'instinto_de_caca');
  const bruto =
    CAPTURA_BASE + CAPTURA_POR_NIVEL_ELEMENTO * nivelAfinidade + CAPTURA_POR_EVOCACAO * evocacao;
  return bruto * (1 + CAPTURA_BONUS_INSTINTO * instinto);
}

export interface AvaliacaoCaptura {
  capturavel: boolean;
  poder: number;
  exigido: number;
  motivo?: string;
}

export function avaliarCaptura(
  p: Personagem,
  prog: Progressao,
  criaturaId: string,
): AvaliacaoCaptura {
  const criatura = CRIATURAS[criaturaId];
  if (!criatura) return { capturavel: false, poder: 0, exigido: 0, motivo: 'Criatura desconhecida.' };
  if ((p.escolas.evocacao ?? 0) <= 0) {
    return { capturavel: false, poder: 0, exigido: criatura.poderBase, motivo: 'Requer pontos em Evocação.' };
  }
  const temAfinidade = criatura.afinidades.some((e) => (p.elementos[e] ?? 0) > 0);
  if (!temAfinidade) {
    const nomes = criatura.afinidades.map((e) => ELEMENTOS[e].nome).join(' ou ');
    return {
      capturavel: false,
      poder: 0,
      exigido: criatura.poderBase,
      motivo: `Sem afinidade: invista em ${nomes} para capturar esta criatura.`,
    };
  }
  const poder = poderCaptura(p, prog, criatura);
  return {
    capturavel: poder >= criatura.poderBase,
    poder,
    exigido: criatura.poderBase,
    motivo: poder >= criatura.poderBase ? undefined : 'Poder de captura insuficiente — suba o elemento de afinidade ou Evocação.',
  };
}

/** Famílias que o jogador consegue capturar hoje (tem afinidade + poder). */
export function familiasCapturaveis(p: Personagem, prog: Progressao): Set<string> {
  const fam = new Set<string>();
  for (const cr of Object.values(CRIATURAS)) {
    if (avaliarCaptura(p, prog, cr.id).capturavel) fam.add(cr.familia);
  }
  return fam;
}

// ---- doma (vínculo) ----

/** Capacidade de vínculo (quantas criaturas podem ser domadas ao mesmo tempo). */
export function capacidadeVinculo(p: Personagem): number {
  if (talento(p, 'vinculo_primal') <= 0) return 0;
  return 1 + talento(p, 'matilha_domada');
}

/** Bônus de poder de uma fera vinculada, dado o nível de vínculo. */
export function bonusVinculo(p: Personagem, nivelVinculo: number): number {
  if (nivelVinculo <= 0) return 0;
  const evolucao = talento(p, 'evolucao_da_fera');
  const alfa = talento(p, 'fera_alfa');
  return nivelVinculo * VINCULO_POR_NIVEL * (1 + 0.25 * evolucao) + ALFA_BONUS * alfa;
}

// ---- evocação ----

export interface ConfigEvocacao {
  modo: ModoEvocacao;
  /** modo 'elemental': o elemento a evocar. */
  elemento?: ElementoId;
  /** modo 'capturada': a criatura. */
  criaturaId?: string;
  /** modo 'capturada': elemento de maestria para imbuir (opcional). */
  elementoImbuido?: ElementoId;
  /** modo 'capturada': nível de vínculo da criatura (0 = não domada). */
  nivelVinculo?: number;
}

export interface ResultadoEvocacao {
  valida: boolean;
  erros: string[];
  nome: string;
  familia?: string;
  poder: number;
  imbuido?: ElementoId;
  vinculada: boolean;
}

export function evocar(p: Personagem, prog: Progressao, cfg: ConfigEvocacao): ResultadoEvocacao {
  const evocacao = p.escolas.evocacao ?? 0;
  const escalaEvoc = 1 + EVOC_ESCALA * evocacao;
  const erros: string[] = [];
  if (evocacao <= 0) erros.push('Requer pontos na escola Evocação.');

  if (cfg.modo === 'elemental') {
    const elem = cfg.elemento && ELEMENTOS[cfg.elemento];
    const nivel = cfg.elemento ? prog.niveisEfetivos[cfg.elemento] ?? 0 : 0;
    if (!elem) erros.push('Elemento inválido.');
    else if (nivel <= 0) erros.push(`Elemento "${elem.nome}" não liberado.`);
    const poder = elem ? (ELEMENTAL_BASE + ELEMENTAL_POR_NIVEL * nivel) * escalaEvoc * elem.fatorPotencia : 0;
    return {
      valida: erros.length === 0,
      erros,
      nome: elem ? `Elemental de ${elem.nome}` : 'Elemental',
      familia: 'elemental',
      poder,
      vinculada: false,
    };
  }

  if (cfg.modo === 'aleatoria') {
    const poder = (ALEATORIA_BASE + ALEATORIA_POR_EVOCACAO * evocacao) * escalaEvoc;
    return {
      valida: erros.length === 0,
      erros,
      nome: 'Criatura Aleatória',
      familia: 'aleatoria',
      poder,
      vinculada: false,
    };
  }

  // capturada
  const criatura = cfg.criaturaId ? CRIATURAS[cfg.criaturaId] : undefined;
  if (!criatura) {
    erros.push('Nenhuma criatura capturada selecionada.');
    return { valida: false, erros, nome: 'Criatura', poder: 0, vinculada: false };
  }
  let imbuido: ElementoId | undefined;
  let multImbuir = 1;
  if (cfg.elementoImbuido) {
    const nivel = prog.niveisEfetivos[cfg.elementoImbuido] ?? 0;
    if (nivel < MAESTRIA_LIMIAR) {
      erros.push(
        `Só é possível imbuir um elemento com maestria (nível ${MAESTRIA_LIMIAR}+): ${ELEMENTOS[cfg.elementoImbuido]?.nome ?? cfg.elementoImbuido} está em ${nivel}.`,
      );
    } else {
      imbuido = cfg.elementoImbuido;
      multImbuir = ELEMENTOS[imbuido].fatorPotencia * (1 + IMBUIR_POR_NIVEL * nivel);
    }
  }
  const nivelVinculo = cfg.nivelVinculo ?? 0;
  const multVinculo = 1 + bonusVinculo(p, nivelVinculo);
  const poder = criatura.poderBase * escalaEvoc * multImbuir * multVinculo;
  const nomeImbuido = imbuido ? `${criatura.nome} de ${ELEMENTOS[imbuido].nome}` : criatura.nome;
  return {
    valida: erros.length === 0,
    erros,
    nome: nomeImbuido,
    familia: criatura.familia,
    poder,
    imbuido,
    vinculada: nivelVinculo > 0,
  };
}

/** Atalho: para uma UI listar quais elementos base o jogador tem afinidade. */
export function afinidadesAtivas(p: Personagem): ElementoBaseId[] {
  return elementosBase()
    .map((e) => e.id as ElementoBaseId)
    .filter((id) => (p.elementos[id] ?? 0) > 0);
}
