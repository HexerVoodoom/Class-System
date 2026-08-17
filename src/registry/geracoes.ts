/**
 * Constantes da ALOCAÇÃO GERACIONAL — os diais da cascata num lugar só.
 *
 * A regra (pedida pelo dono do projeto): ponto direto nasce restrito aos 17
 * elementos base; investir nos DOIS pais de um par faz o par acumular pontos
 * PASSIVOS (a cada `DIVISOR_CASCATA` pontos efetivos em CADA pai, 1 ponto
 * passivo no filho — 5 fogo + 5 água → 1 vapor); um derivado que acumula
 * `LIMIAR_DESTRAVAMENTO` passivos DESTRAVA a alocação direta nele. Triplas e
 * quádruplas seguem a mesma regra com os pais de aridade N−1.
 *
 * O peso de geração NÃO é um multiplicador de potência novo — a potência por
 * aridade já existe (`FATOR_BASE_ARIDADE` + compensação de aridade nas
 * skills). O peso aqui é ECONÔMICO: `CUSTO_PONTO_ALOCACAO` faz 1 ponto direto
 * em gerações altas custar mais orçamento, redistribuindo em vez de
 * multiplicar (invariante de balanceamento nº 3).
 *
 * `pesoDiretoNaCascata` fecha a arbitragem por construção: 1 ponto de
 * ORÇAMENTO compra o MESMO progresso de cascata onde quer que seja gasto.
 * Se este peso virar 1, destravar um par e despejar pontos nele vira máquina
 * de inflação de gerações altas — há teste de não-arbitragem travando.
 */

export type Aridade = 1 | 2 | 3 | 4;

/** Pontos efetivos exigidos em CADA pai para render 1 ponto passivo no filho. */
export const DIVISOR_CASCATA: Record<Aridade, number> = { 1: 0, 2: 5, 3: 4, 4: 3 };

/** Pontos PASSIVOS acumulados que destravam a alocação direta no elemento. */
export const LIMIAR_DESTRAVAMENTO: Record<Aridade, number> = { 1: 0, 2: 10, 3: 6, 4: 4 };

/** Custo, em pontos de orçamento, de 1 ponto DIRETO em cada geração. */
export const CUSTO_PONTO_ALOCACAO: Record<Aridade, number> = { 1: 1, 2: 3, 3: 10, 4: 30 };

/** Custo, em orçamento, de 1 ponto obtido pela cascata pura (build simétrica):
 *  gen-2 = 5×2 bases = 10 · gen-3 = 20×3 = 60 · gen-4 = 60×4 = 240. */
export const CUSTO_CASCATA_EQUIVALENTE: Record<Aridade, number> = { 1: 1, 2: 10, 3: 60, 4: 240 };

/** Divisor da cascata para os elementos ESPECIAIS (primordial/ciclo/nulo),
 *  cujos pais declarados são as próprias bases da receita ampla. */
export const DIVISOR_CASCATA_ESPECIAL = 20;

/**
 * Fração de um ponto DIRETO que alimenta a geração seguinte. Amarrada ao
 * custo de propósito (custo direto ÷ custo da cascata equivalente):
 * 1 · 0.3 · 0.1667 · 0.125 — mesmo progresso por ponto de orçamento.
 */
export function pesoDiretoNaCascata(aridade: Aridade): number {
  return CUSTO_PONTO_ALOCACAO[aridade] / CUSTO_CASCATA_EQUIVALENTE[aridade];
}

/**
 * Curva de orçamento sugerida por tier de personagem — conteúdo de registro
 * lido pela UI/consumidores, NUNCA imposto pelo motor (point-buy continua
 * aberto). Alvo de desenho: no teto (1200) existe no máximo UM destrave de
 * quádrupla — nunca dois (há teste travando).
 */
export const ORCAMENTO_POR_TIER: Record<number, number> = {
  1: 60, 2: 120, 3: 200, 4: 340, 5: 500, 6: 800, 7: 1200,
};
