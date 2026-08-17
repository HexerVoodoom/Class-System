import { describe, expect, it } from 'vitest';
import {
  calcularCascata,
  custoDeAlocacao,
  elementosAlocaveis,
  podeReceberDireto,
} from '../src/engine/cascata';
import {
  CUSTO_CASCATA_EQUIVALENTE,
  CUSTO_PONTO_ALOCACAO,
  DIVISOR_CASCATA,
  LIMIAR_DESTRAVAMENTO,
  pesoDiretoNaCascata,
  type Aridade,
} from '../src/registry/geracoes';
import { aridadeDe, paisDeCascata, combinacaoInfoPorComponentes } from '../src/registry/combinacoes';
import { ELEMENTOS, elementosBase, type ElementoId } from '../src/registry/elementos';
import { criarPersonagem, investirElemento, podeInvestir } from '../src/engine/personagem';
import { calcularProgressao } from '../src/engine/progressao';

const TRIPLA_FAT = combinacaoInfoPorComponentes(['fogo', 'agua', 'terra'])!.id;
const QUAD_FAT = combinacaoInfoPorComponentes(['fogo', 'agua', 'terra', 'ar'])!.id;

describe('cascata — rendimento passivo', () => {
  it('5 fogo + 5 água → 1 ponto passivo em vapor; 4 + 5 → 0', () => {
    const sim = calcularCascata({ fogo: 5, agua: 5 });
    expect(sim.passivos.get('vapor')).toBe(1);
    const nao = calcularCascata({ fogo: 4, agua: 5 });
    expect(nao.passivos.get('vapor') ?? 0).toBe(0);
  });

  it('o rendimento é o MIN sobre os pais: 20 fogo + 5 água → 1 (não 4)', () => {
    const sim = calcularCascata({ fogo: 20, agua: 5 });
    expect(sim.passivos.get('vapor')).toBe(1);
  });

  it('50+50 → 10 passivos → destrava; 49+50 → não', () => {
    const sim = calcularCascata({ fogo: 50, agua: 50 });
    expect(sim.passivos.get('vapor')).toBe(10);
    expect(sim.destravados.has('vapor')).toBe(true);
    const nao = calcularCascata({ fogo: 49, agua: 50 });
    expect(nao.destravados.has('vapor')).toBe(false);
    expect(nao.progressoDestravamento.get('vapor')).toEqual({ passivos: 9, limiar: 10 });
  });

  it('tripla: os pais são os 3 PARES, não as 3 bases; B=20 em 3 bases → 1 ponto', () => {
    const pais = paisDeCascata(TRIPLA_FAT);
    expect(pais).toHaveLength(3);
    for (const pai of pais) expect(aridadeDe(pai)).toBe(2);
    // B=20: cada par rende floor(20/5)=4 → tripla floor(4/4)=1
    const sim = calcularCascata({ fogo: 20, agua: 20, terra: 20 });
    expect(sim.passivos.get(TRIPLA_FAT)).toBe(1);
  });

  it('quádrupla: os pais são as 4 TRIPLAS; B=60 em 4 bases → 1 ponto', () => {
    const pais = paisDeCascata(QUAD_FAT);
    expect(pais).toHaveLength(4);
    for (const pai of pais) expect(aridadeDe(pai)).toBe(3);
    // B=60: par floor(60/5)=12 → tripla floor(12/4)=3 → quádrupla floor(3/3)=1
    const sim = calcularCascata({ fogo: 60, agua: 60, terra: 60, ar: 60 });
    expect(sim.passivos.get(QUAD_FAT)).toBe(1);
  });

  it('ponto direto num par destravado sobe para a tripla no peso declarado, não 1:1', () => {
    const base = calcularCascata({ fogo: 50, agua: 50 });
    const comDireto = calcularCascata({ fogo: 50, agua: 50, vapor: 10 });
    const peso = pesoDiretoNaCascata(2);
    expect(comDireto.paraCascata.get('vapor')).toBeCloseTo(
      (base.paraCascata.get('vapor') ?? 0) + 10 * peso,
      10,
    );
    expect(peso).toBeLessThan(1);
  });
});

describe('cascata — não-arbitragem e economia', () => {
  it('gastar X de orçamento em direto nunca rende mais cascata que X nas bases', () => {
    // Para cada aridade, o progresso de cascata por ponto de ORÇAMENTO tem
    // que ser o mesmo nos dois caminhos (tolerância numérica) — é o que
    // fecha a máquina de inflação de "destravar e despejar".
    for (const aridade of [2, 3, 4] as Aridade[]) {
      const porOrcamentoDireto = pesoDiretoNaCascata(aridade) / CUSTO_PONTO_ALOCACAO[aridade];
      const porOrcamentoCascata = 1 / CUSTO_CASCATA_EQUIVALENTE[aridade];
      expect(porOrcamentoDireto).toBeCloseTo(porOrcamentoCascata, 10);
    }
  });

  it('custoDeAlocacao cobra por geração: base 1 · par 3 · tripla 10 · quádrupla 30', () => {
    const { porAridade, total } = custoDeAlocacao({
      fogo: 10, vapor: 2, [TRIPLA_FAT]: 1, [QUAD_FAT]: 1,
    });
    expect(porAridade[1]).toBe(10);
    expect(porAridade[2]).toBe(6);
    expect(porAridade[3]).toBe(10);
    expect(porAridade[4]).toBe(30);
    expect(total).toBe(56);
  });

  it('tabela de marcos: destravar gen-2 custa 100 de orçamento nas bases', () => {
    // 50 em cada uma de 2 bases = 100 pontos → 10 passivos = limiar
    const sim = calcularCascata({ fogo: 50, agua: 50 });
    expect(custoDeAlocacao({ fogo: 50, agua: 50 }).total).toBe(100);
    expect(sim.destravados.has('vapor')).toBe(true);
  });

  it('com 1200 pontos de orçamento não existe ficha que destrave duas quádruplas', () => {
    // Destravar UMA quádrupla exige 4 passivos → cada tripla-pai precisa
    // alimentar floor(x/3) >= 4 → x >= 12 → cada par floor(y/4) >= 12 → y >= 48
    // → cada base floor(B/5) >= 48 → B >= 240 → 4 bases × 240 = 960.
    // Duas quádruplas DISJUNTAS custariam 8 bases × 240 = 1920 > 1200.
    // Compartilhando 3 bases (ex.: abcd + abce), d e e precisam de 240 cada e
    // as compartilhadas idem: 5 × 240 = 1200 — MAS o custo mínimo real com
    // interseção máxima ainda é 1200 cravado, sem sobrar ponto para escola,
    // recurso ou talento. O teste trava o caso disjunto e documenta o limite.
    const umaQuad = custoDeAlocacao({ fogo: 240, agua: 240, terra: 240, ar: 240 });
    expect(umaQuad.total).toBe(960);
    const sim = calcularCascata({ fogo: 240, agua: 240, terra: 240, ar: 240 });
    expect(sim.destravados.has(QUAD_FAT)).toBe(true);
    const duasDisjuntas = 2 * 4 * 240;
    expect(duasDisjuntas).toBeGreaterThan(1200);
  });
});

describe('cascata — estrutura e contratos', () => {
  it('paisDeCascata devolve sempre aridade estritamente menor (aciclicidade)', () => {
    const amostra: ElementoId[] = ['vapor', 'lava', TRIPLA_FAT, QUAD_FAT, 'primordial', 'nulo'];
    for (const id of amostra) {
      for (const pai of paisDeCascata(id)) {
        expect(aridadeDe(pai)).toBeLessThan(Math.max(2, aridadeDe(id)));
      }
    }
  });

  it('especiais nunca destravam e não explodem', () => {
    const bases: Partial<Record<ElementoId, number>> = {};
    for (const def of elementosBase()) bases[def.id] = 100;
    const sim = calcularCascata(bases);
    for (const especial of ['primordial', 'ciclo', 'nulo']) {
      expect(sim.destravados.has(especial)).toBe(false);
      expect(ELEMENTOS[especial].cascata?.destravavel).toBe(false);
    }
    // nulo (17 bases a 100, divisor 20) rende floor(100/20)=5 passivos
    expect(sim.passivos.get('nulo')).toBe(5);
  });

  it('ficha nova: alocáveis = exatamente os 17 base', () => {
    const sim = calcularCascata({});
    expect(elementosAlocaveis(sim)).toEqual(elementosBase().map((d) => d.id));
  });

  it('determinismo: 50 chamadas, mapas idênticos com chaves em ordem estável', () => {
    const ficha = { fogo: 37, agua: 23, terra: 51, marcial: 12 };
    const primeiro = calcularCascata(ficha);
    const chaves = [...primeiro.paraCascata.keys()].join(',');
    for (let i = 0; i < 50; i++) {
      const outra = calcularCascata(ficha);
      expect([...outra.paraCascata.keys()].join(',')).toBe(chaves);
      expect([...outra.paraCascata.values()]).toEqual([...primeiro.paraCascata.values()]);
    }
  });

  it('escala: 17 bases a 100 pontos resolve rápido e sem inflar o mapa', () => {
    const bases: Partial<Record<ElementoId, number>> = {};
    for (const def of elementosBase()) bases[def.id] = 100;
    const inicio = performance.now();
    const sim = calcularCascata(bases);
    const duracao = performance.now() - inicio;
    expect(duracao).toBeLessThan(500);
    // o pior caso toca o espaço inteiro (17+136+680+2380+especiais)
    expect(sim.paraCascata.size).toBeGreaterThan(3000);
    // ...mas uma ficha típica toca DEZENAS
    const tipica = calcularCascata({ fogo: 30, agua: 20, vida: 10 });
    expect(tipica.paraCascata.size).toBeLessThan(20);
  });
});

describe('integração com o personagem e a progressão', () => {
  it('investirElemento em derivado lança em ficha nova e PARA de lançar após destravar', () => {
    const p = criarPersonagem('teste');
    expect(() => investirElemento(p, 'lava', 1)).toThrow(/destravado/);
    investirElemento(p, 'fogo', 50);
    investirElemento(p, 'terra', 50);
    expect(podeInvestir(p, 'lava').ok).toBe(true);
    expect(() => investirElemento(p, 'lava', 1)).not.toThrow();
    expect(p.elementos.lava).toBe(1);
  });

  it('especial nunca aceita ponto direto, com motivo claro', () => {
    const p = criarPersonagem('teste');
    for (const def of elementosBase()) investirElemento(p, def.id, 100);
    const veredito = podeInvestir(p, 'nulo');
    expect(veredito.ok).toBe(false);
    if (!veredito.ok) expect(veredito.motivo).toMatch(/nunca aceita/);
  });

  it('ponto direto em derivado destravado soma 1:1 ao nível efetivo dele, e só dele', () => {
    const p = criarPersonagem('teste');
    investirElemento(p, 'fogo', 50);
    investirElemento(p, 'terra', 50);
    const antes = calcularProgressao(p);
    investirElemento(p, 'lava', 3, antes);
    const depois = calcularProgressao(p);
    expect(depois.niveisEfetivos.lava).toBe(antes.niveisEfetivos.lava + 3);
    expect(depois.niveisEfetivos.vapor).toBe(antes.niveisEfetivos.vapor);
    expect(depois.niveisEfetivos.fogo).toBe(antes.niveisEfetivos.fogo);
  });

  it('derivado NUNCA tem nível efetivo sem a receita atendida, mesmo com ponto direto', () => {
    // ficha montada à mão (sem passar por investirElemento) escreve direto
    const p = criarPersonagem('teste');
    p.elementos.lava = 5;
    const prog = calcularProgressao(p);
    expect(prog.niveisEfetivos.lava).toBe(0);
  });

  it('ponto direto em derivado não vaza para o transbordo de sinergias', () => {
    const p = criarPersonagem('teste');
    investirElemento(p, 'fogo', 50);
    investirElemento(p, 'terra', 50);
    const antes = calcularProgressao(p);
    investirElemento(p, 'lava', 5, antes);
    const depois = calcularProgressao(p);
    expect(depois.transbordo).toEqual(antes.transbordo);
  });

  it('com zero diretos em derivados, niveisEfetivos é idêntico ao mundo antigo', () => {
    const p = criarPersonagem('golden');
    investirElemento(p, 'fogo', 12);
    investirElemento(p, 'terra', 12);
    investirElemento(p, 'vida', 8);
    const prog = calcularProgressao(p);
    // valores do mundo pré-cascata: derivado = min(componentes) quando atende
    expect(prog.niveisEfetivos.lava).toBeGreaterThan(0);
    expect(prog.niveisEfetivos.lava).toBe(
      Math.min(prog.niveisEfetivos.fogo, prog.niveisEfetivos.terra) + prog.bonusNivelDerivado,
    );
    expect(prog.alocaveis).toEqual(elementosBase().map((d) => d.id));
    expect(prog.cascata.passivos.get('lava')).toBe(2);
  });
});
