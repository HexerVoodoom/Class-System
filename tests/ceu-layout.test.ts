import { describe, expect, it } from 'vitest';
import {
  FAIXAS,
  N_BASES,
  W,
  enderecoCanonico,
  posicaoBase,
  posicaoCombinacao,
  raioComNivel,
} from '../src/ui/ceu-layout';

function combinacoes(k: number): number[][] {
  const saida: number[][] = [];
  const atual: number[] = [];
  const rec = (i: number) => {
    if (atual.length === k) {
      saida.push([...atual]);
      return;
    }
    for (let j = i; j < N_BASES; j++) {
      atual.push(j);
      rec(j + 1);
      atual.pop();
    }
  };
  rec(0);
  return saida;
}

describe('endereço canônico do céu', () => {
  it('é injetivo sobre TODO o espaço — nenhuma combinação divide endereço', () => {
    for (const k of [2, 3, 4]) {
      const cs = combinacoes(k);
      const enderecos = new Set(
        cs.map((c) => {
          const e = enderecoCanonico(c);
          return `${e.ancora}|${e.arco}|${e.offsets.join(',')}`;
        }),
      );
      expect(enderecos.size).toBe(cs.length);
    }
  });

  it('não depende da ordem em que os componentes chegam', () => {
    const a = enderecoCanonico([2, 9, 14]);
    const b = enderecoCanonico([14, 2, 9]);
    expect(a).toEqual(b);
  });

  it('o arco mede dispersão: componentes vizinhos têm arco menor que opostos', () => {
    const vizinhos = enderecoCanonico([0, 1]);
    const opostos = enderecoCanonico([0, 8]);
    expect(vizinhos.arco).toBeLessThan(opostos.arco);
  });
});

describe('posicionamento', () => {
  it('as 3.196 posições de aridade 2–4 são todas distintas', () => {
    const chaves = new Set<string>();
    let total = 0;
    for (const k of [2, 3, 4]) {
      for (const c of combinacoes(k)) {
        const p = posicaoCombinacao(c);
        chaves.add(`${p.x.toFixed(3)},${p.y.toFixed(3)}`);
        total++;
      }
    }
    expect(total).toBe(136 + 680 + 2380);
    expect(chaves.size).toBe(total);
  });

  it('nada é desenhado fora do quadro', () => {
    for (const k of [2, 3, 4]) {
      for (const c of combinacoes(k)) {
        const p = posicaoCombinacao(c);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(W);
        expect(p.y).toBeLessThanOrEqual(W);
      }
    }
  });

  it('cada aridade fica na sua faixa, sem invadir a vizinha', () => {
    const raio = (p: { x: number; y: number }) => Math.hypot(p.x - W / 2, p.y - W / 2);
    const faixaDe = (k: 2 | 3 | 4) => {
      const rs = combinacoes(k).map((c) => raio(posicaoCombinacao(c)));
      return { min: Math.min(...rs), max: Math.max(...rs) };
    };
    const f2 = faixaDe(2);
    const f3 = faixaDe(3);
    const f4 = faixaDe(4);
    expect(f2.max).toBeLessThanOrEqual(FAIXAS[2].rOut + 0.001);
    expect(f3.max).toBeLessThan(f2.min);
    expect(f4.max).toBeLessThan(f3.min);
    expect(f4.min).toBeGreaterThan(40); // não encosta no núcleo
  });

  it('a posição é ESTÁVEL: a mesma combinação sempre cai no mesmo ponto', () => {
    const a = posicaoCombinacao([1, 5, 9, 13]);
    const b = posicaoCombinacao([13, 9, 5, 1]);
    expect(a).toEqual(b);
  });

  it('as bases ficam no anel externo, igualmente espaçadas', () => {
    const rs = Array.from({ length: N_BASES }, (_, i) => {
      const p = posicaoBase(i);
      return Math.hypot(p.x - W / 2, p.y - W / 2);
    });
    for (const r of rs) expect(r).toBeCloseTo(370, 6);
  });

  it('o raio do nó cresce com o nível mas satura — não vira bolha no miolo', () => {
    expect(raioComNivel(2.4, 0)).toBeCloseTo(2.4);
    expect(raioComNivel(2.4, 10)).toBeGreaterThan(2.4);
    expect(raioComNivel(2.4, 100)).toBeCloseTo(2.4 * 1.55, 6);
  });
});
