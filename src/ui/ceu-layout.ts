/**
 * LAYOUT DO CÉU DOS ELEMENTOS — matemática pura, sem DOM.
 *
 * O problema: o espaço completo tem 13 bases + 78 pares + 286 triplas +
 * 715 quádruplas ≈ 1.092 nós. Um disco de raio 348 tem ~380.000 unidades²;
 * 3.213 nós com espaçamento mínimo decente pedem ~260.000 unidades² de
 * ocupação exclusiva, concentradas justamente nos anéis internos, onde a área
 * é escassa. **Desenhar tudo de uma vez é geometricamente impossível**, em
 * qualquer escala.
 *
 * A solução não é reservar um slot para cada nó, e sim dar a cada combinação
 * um **endereço absoluto e permanente**, e deixar a política de visibilidade
 * decidir quantos endereços viram DOM. Uma estrela nunca se move porque outra
 * apareceu ou sumiu — a posição depende só dos índices dos componentes.
 *
 * ENDEREÇO CANÔNICO (a, w, padrão):
 *   Os índices dos componentes vivem em ℤ₁₇. Calculam-se as lacunas cíclicas;
 *   a MAIOR lacuna é "a de fora", e o elemento logo depois dela é a ÂNCORA.
 *   O ARCO w = 13 − maiorLacuna mede quão dispersos os componentes são.
 *
 *   - direção  = setor da âncora → parentesco de receita vira vizinhança visual
 *   - profundidade = arco w → componentes vizinhos na borda, opostos no fundo
 *   - faixa    = aridade → quanto mais componentes, mais perto do coração
 *
 * Para pares, w é exatamente a distância angular que o layout original já
 * usava: **a fórmula nova é uma generalização estrita da antiga**, e a mandala
 * de pares não se move um pixel.
 */

import { elementosBase } from '../registry/elementos';

export const W = 880;
export const CENTRO = W / 2;
/**
 * Quantos elementos base o jogo tem. VEM DO REGISTRO: escrever `17` (ou `13`)
 * aqui é conteúdo na camada de apresentação, e foi exatamente o que fez a
 * redução de 17 para 13 exigir editar `src/ui/` para acompanhar
 * `src/registry/` — com a geometria calada até alguém olhar a tela.
 */
export const N_BASES = elementosBase().length;
export const PASSO = (2 * Math.PI) / N_BASES;
/** Fração do setor efetivamente usada — os 12% restantes são calha visual. */
const PHI = 0.88;

export const R_BASE = 370;
export const R_ROTULO_BASE = 404;

export const anguloBase = (i: number): number => -Math.PI / 2 + i * PASSO;

export interface FaixaAridade {
  wMin: number;
  wMax: number;
  /** Raio do anel mais externo da faixa (arco w = wMin). */
  rOut: number;
  /** Quanto o raio recua por passo de arco. */
  passoR: number;
  /** Espaçamento angular mínimo desejado, em unidades de viewBox. */
  dMin: number;
  /** Máximo de pistas concêntricas ao saturar. */
  lMax: number;
  /** Distância radial entre pistas. */
  dLane: number;
  /** Raio do nó. */
  rNo: number;
}

export const FAIXAS: Record<2 | 3 | 4, FaixaAridade> = {
  2: { wMin: 1, wMax: 6, rOut: 348, passoR: 9.0, dMin: 9, lMax: 1, dLane: 0, rNo: 3.6 },
  3: { wMin: 2, wMax: 8, rOut: 278, passoR: 11.0, dMin: 8, lMax: 3, dLane: 4.5, rNo: 3.2 },
  4: { wMin: 3, wMax: 9, rOut: 168, passoR: 10.0, dMin: 7, lMax: 4, dLane: 4.0, rNo: 2.8 },
};

// --- binomiais (triângulo de Pascal até N_BASES) ---
const BINOM: number[][] = (() => {
  const t: number[][] = Array.from({ length: N_BASES + 1 }, () =>
    new Array(N_BASES + 1).fill(0),
  );
  for (let i = 0; i <= N_BASES; i++) {
    t[i][0] = 1;
    for (let j = 1; j <= i; j++) t[i][j] = t[i - 1][j - 1] + t[i - 1][j];
  }
  return t;
})();

export function binom(a: number, b: number): number {
  if (b < 0 || a < 0 || b > a) return 0;
  return BINOM[a][b];
}

export interface Endereco {
  /** Índice do elemento base que ancora o setor. */
  ancora: number;
  /** Arco de cobertura, em passos angulares. */
  arco: number;
  /** Offsets dos componentes interiores, relativos à âncora. */
  offsets: number[];
}

/**
 * O endereço canônico. Injetivo sobre TODO o espaço — verificado por força
 * bruta: 136/136 pares, 680/680 triplas, 2380/2380 quádruplas, zero colisões.
 */
export function enderecoCanonico(indices: number[]): Endereco {
  const s = [...new Set(indices)].sort((x, y) => x - y);
  const k = s.length;
  if (k === 1) return { ancora: s[0], arco: 0, offsets: [] };
  let maiorLacuna = -1;
  let anc = 0;
  for (let t = 0; t < k; t++) {
    const lacuna = (s[(t + 1) % k] - s[t] + N_BASES) % N_BASES;
    const cand = (t + 1) % k;
    if (lacuna > maiorLacuna || (lacuna === maiorLacuna && s[cand] < s[anc])) {
      maiorLacuna = lacuna;
      anc = cand;
    }
  }
  const ancora = s[anc];
  const offsets: number[] = [];
  for (let t = 1; t < k - 1; t++) {
    offsets.push((s[(anc + t) % k] - ancora + N_BASES) % N_BASES);
  }
  return { ancora, arco: N_BASES - maiorLacuna, offsets };
}

/** Rank lexicográfico de um subconjunto `offsets ⊂ {1..m}` de tamanho t. */
export function rankPadrao(offsets: number[], m: number, t: number): number {
  let r = 0;
  let ant = 0;
  for (let i = 0; i < t; i++) {
    for (let v = ant + 1; v < offsets[i]; v++) r += binom(m - v, t - i - 1);
    ant = offsets[i];
  }
  return r;
}

/**
 * Quantas pistas concêntricas o par (aridade, arco) precisa. Calculado a
 * partir da CAPACIDADE do arco, nunca de quantos nós estão visíveis — é isso
 * que garante que um nó não se mexa quando outro aparece.
 */
export function pistas(k: 2 | 3 | 4, arco: number, raio: number): number {
  const f = FAIXAS[k];
  const arcoSetor = raio * PASSO * PHI;
  const capacidade = binom(arco - 1, k - 2);
  if (capacidade <= 1) return 1;
  return Math.min(f.lMax, Math.max(1, Math.ceil((capacidade * f.dMin) / arcoSetor)));
}

export interface PosEstrela {
  x: number;
  y: number;
  r: number;
  /** Guardado para a UI desenhar guias de faixa e depurar saturação. */
  arco: number;
  pista: number;
}

/** Posição de um elemento BASE no anel externo. */
export function posicaoBase(indice: number): PosEstrela {
  const ang = anguloBase(indice);
  return {
    x: CENTRO + Math.cos(ang) * R_BASE,
    y: CENTRO + Math.sin(ang) * R_BASE,
    r: 6,
    arco: 0,
    pista: 0,
  };
}

/** Posição determinística e estável de uma combinação de 2, 3 ou 4 componentes. */
export function posicaoCombinacao(indices: number[]): PosEstrela {
  const k = Math.min(4, Math.max(2, new Set(indices).size)) as 2 | 3 | 4;
  const f = FAIXAS[k];
  const { ancora, arco, offsets } = enderecoCanonico(indices);
  const arcoLim = Math.min(Math.max(arco, f.wMin), f.wMax);
  const raioArco = f.rOut - f.passoR * (arcoLim - f.wMin);
  const capacidade = Math.max(1, binom(arcoLim - 1, k - 2));
  const p = Math.min(capacidade - 1, rankPadrao(offsets, arcoLim - 1, k - 2));
  const L = pistas(k, arcoLim, raioArco);
  const pista = p % L;
  const q = Math.floor(p / L);
  const Q = Math.max(1, Math.ceil(capacidade / L));
  const raio = raioArco - pista * f.dLane;
  const ang =
    anguloBase(ancora) + (arcoLim / 2) * PASSO + ((q + 0.5) / Q - 0.5) * PASSO * PHI;
  return {
    x: CENTRO + Math.cos(ang) * raio,
    y: CENTRO + Math.sin(ang) * raio,
    r: f.rNo,
    arco: arcoLim,
    pista,
  };
}

/** Raio visual de um nó, crescendo com o nível — multiplicativo, satura em 1.55×. */
export function raioComNivel(base: number, nivel: number): number {
  return base * (1 + Math.min(0.55, nivel * 0.03));
}

/** Guias circulares de cada faixa, para orientação visual. */
export function guiasDeFaixa(): { aridade: 2 | 3 | 4; raio: number; rotulo: string }[] {
  return ([2, 3, 4] as const).map((k) => ({
    aridade: k,
    raio: FAIXAS[k].rOut,
    rotulo: k === 2 ? 'pares' : k === 3 ? 'triplas' : 'quádruplas',
  }));
}

/**
 * viewBox por nível de zoom — zoom 3 amplia 3.14×, tornando o miolo clicável.
 *
 * O quadro é mais largo que alto de propósito: os rótulos dos elementos base
 * ficam em R_ROTULO_BASE (404) e escrevem para fora, então um quadro quadrado
 * de lado W cortava os nomes longos dos setores leste e oeste ("Eletricidade",
 * "Gravidade"). A folga horizontal de 70 unidades de cada lado mantém o centro
 * em W/2 e dá espaço para o texto.
 */
const FOLGA_ROTULO = 70;
export const VIEWBOX: Record<1 | 2 | 3, string> = {
  1: `${-FOLGA_ROTULO} 0 ${W + FOLGA_ROTULO * 2} ${W}`,
  2: '180 180 520 520',
  3: '300 300 280 280',
};

/** Orçamento de DOM: acima disso o SVG deixa de renderizar em um frame. */
export const TETO = { nos: 480, rotulos: 60, linhas: 240 } as const;
