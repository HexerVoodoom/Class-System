import { describe, expect, it } from 'vitest';
import {
  criarPersonagem,
  investirElemento,
  investirEscola,
  investirRecurso,
  investirTalento,
} from '../src/engine/personagem';
import { calcularProgressao } from '../src/engine/progressao';
import {
  calcularSkill,
  slotsModificador,
  tagsDaSkill,
  avaliarModificador,
  type SkillConfig,
} from '../src/engine/skills';
import { calcularFusao, previewFusao } from '../src/engine/fusao';
import { elementoDePorComponentes } from '../src/registry/combinacoes';
import type { ElementoBaseId } from '../src/registry/elementos';

const skill = (elemento: string, over: Partial<SkillConfig> = {}): SkillConfig => ({
  nome: 't',
  elemento,
  escola: 'conjuracao',
  fontes: [{ recurso: 'mana', proporcao: 100 }],
  energia: 15,
  tempoConjuracaoSegundos: 2,
  alcanceMetros: 0,
  area: { tipo: 'unico' },
  entrega: { tipo: 'instantaneo' },
  ...over,
});

function ficha(elems: [ElementoBaseId, number][], escola = 12) {
  const p = criarPersonagem('t');
  for (const [e, n] of elems) investirElemento(p, e, n);
  investirEscola(p, 'conjuracao', escola);
  investirRecurso(p, 'mana', 10);
  return p;
}

describe('fusão: os elementos das skills se fundem', () => {
  it('fundir uma skill de fogo com uma de terra produz Lava', () => {
    const p = ficha([
      ['fogo', 15],
      ['terra', 15],
    ]);
    const prog = calcularProgressao(p);
    const r = calcularFusao(p, prog, {
      nome: 'f',
      componentes: [skill('fogo'), skill('terra')],
    });
    expect(r.elementoResultante).toBe('lava');
    expect(r.nomeElementoResultante).toBe('Lava');
    expect(r.geracao).toBe(2);
  });

  it('três componentes produzem a tripla e uma skill de 3ª geração', () => {
    const comps: ElementoBaseId[] = ['fogo', 'terra', 'sombra'];
    const p = ficha(comps.map((e) => [e, 20] as [ElementoBaseId, number]));
    const prog = calcularProgressao(p);
    const r = calcularFusao(p, prog, {
      nome: 'f',
      componentes: comps.map((e) => skill(e)),
    });
    expect(r.geracao).toBe(3);
    expect(r.elementoResultante).toBe(elementoDePorComponentes(comps)!.id);
    expect(r.modo.id).toBe('prisma');
    expect(r.basesEnvolvidas).toEqual(comps);
  });

  it('quatro componentes produzem a quádrupla', () => {
    const comps: ElementoBaseId[] = ['fogo', 'terra', 'sombra', 'morte'];
    const p = ficha(comps.map((e) => [e, 22] as [ElementoBaseId, number]));
    const prog = calcularProgressao(p);
    const r = calcularFusao(p, prog, {
      nome: 'f',
      componentes: comps.map((e) => skill(e, { energia: 12 })),
    });
    expect(r.elementoResultante).toBe(elementoDePorComponentes(comps)!.id);
    expect(r.basesEnvolvidas).toHaveLength(4);
  });

  it('sem a combinação desbloqueada, a fusão acontece mas avisa a perda', () => {
    const p = ficha([
      ['fogo', 30],
      ['terra', 4],
    ]);
    const prog = calcularProgressao(p);
    const r = calcularFusao(p, prog, {
      nome: 'f',
      componentes: [skill('fogo'), skill('fogo')],
    });
    expect(r.elementoResultante).toBe('fogo');
    expect(r.avisos.some((a) => a.includes('mesmo elemento base'))).toBe(true);
  });

  it('previewFusao antecipa o elemento sem calcular nada', () => {
    const p = ficha([
      ['fogo', 15],
      ['terra', 15],
    ]);
    const prog = calcularProgressao(p);
    const pv = previewFusao(prog, [
      { elemento: 'fogo', escola: 'conjuracao' },
      { elemento: 'terra', escola: 'conjuracao' },
    ]);
    expect(pv.nome).toBe('Lava');
    expect(pv.liberado).toBe(true);
    expect(pv.geracao).toBe(2);
  });
});

describe('modo de fusão: emerge da relação, não da escolha', () => {
  it('elementos em oposição produzem Catálise', () => {
    const p = ficha([
      ['vida', 15],
      ['morte', 15],
    ]);
    const prog = calcularProgressao(p);
    const r = calcularFusao(p, prog, {
      nome: 'f',
      componentes: [skill('vida'), skill('morte')],
    });
    expect(r.modo.id).toBe('catalise');
  });

  it('elementos aliados produzem Ressonância, que é a mais barata', () => {
    const p = ficha([
      ['luz', 15],
      ['vida', 15],
    ]);
    const prog = calcularProgressao(p);
    const r = calcularFusao(p, prog, {
      nome: 'f',
      componentes: [skill('luz'), skill('vida')],
    });
    expect(r.modo.id).toBe('ressonancia');
    expect(r.modo.taxaCusto).toBeLessThan(1);
  });

  it('três ou mais componentes sempre produzem Prisma', () => {
    const comps: ElementoBaseId[] = ['agua', 'ar', 'eletricidade'];
    const p = ficha(comps.map((e) => [e, 20] as [ElementoBaseId, number]));
    const prog = calcularProgressao(p);
    const r = calcularFusao(p, prog, { nome: 'f', componentes: comps.map((e) => skill(e)) });
    expect(r.modo.id).toBe('prisma');
  });
});

describe('fusão: o invariante de balanceamento', () => {
  it('fundir nunca é muito mais eficiente do que lançar as skills separadamente', () => {
    const comps: ElementoBaseId[] = ['fogo', 'terra', 'sombra'];
    const p = ficha(comps.map((e) => [e, 20] as [ElementoBaseId, number]));
    const prog = calcularProgressao(p);
    const r = calcularFusao(p, prog, { nome: 'f', componentes: comps.map((e) => skill(e)) });
    const eficienciaRelativa = r.ganhoDeFusao / r.taxaDeCusto;
    // o teto é 1.10; qualquer coisa acima disso torna fundir obrigatório
    expect(eficienciaRelativa).toBeLessThanOrEqual(1.101);
    expect(eficienciaRelativa).toBeGreaterThan(0.7);
  });

  it('fundir sempre custa mais do que lançar separado', () => {
    const p = ficha([
      ['fogo', 15],
      ['terra', 15],
    ]);
    const prog = calcularProgressao(p);
    const r = calcularFusao(p, prog, {
      nome: 'f',
      componentes: [skill('fogo'), skill('terra')],
    });
    expect(r.taxaDeCusto).toBeGreaterThan(1);
  });

  it('Arte da Fusão desconta a taxa de custo', () => {
    const base = ficha([
      ['fogo', 15],
      ['terra', 15],
    ]);
    const comTalento = ficha([
      ['fogo', 15],
      ['terra', 15],
    ]);
    investirTalento(comTalento, 'arte_da_fusao', 3);
    const cfg = { nome: 'f', componentes: [skill('fogo'), skill('terra')] };
    const semDesconto = calcularFusao(base, calcularProgressao(base), cfg);
    const comDesconto = calcularFusao(comTalento, calcularProgressao(comTalento), cfg);
    expect(comDesconto.taxaDeCusto).toBeLessThan(semDesconto.taxaDeCusto);
  });

  it('a fusão eleva o teto de energia — é para isso que ela serve', () => {
    const p = ficha([
      ['fogo', 15],
      ['terra', 15],
    ]);
    const prog = calcularProgressao(p);
    const limite = calcularSkill(p, prog, skill('fogo')).limites.energiaMaxima;
    // energia total acima do teto de uma skill sozinha, mas dentro do de fusão
    const energia = limite * 0.7;
    const r = calcularFusao(p, prog, {
      nome: 'f',
      componentes: [skill('fogo', { energia }), skill('terra', { energia })],
    });
    expect(energia * 2).toBeGreaterThan(limite);
    expect(r.erros.filter((e) => e.includes('Energia'))).toHaveLength(0);
  });
});

describe('modificadores de 2ª geração', () => {
  it('as tags da skill saem da configuração', () => {
    const tags = tagsDaSkill(skill('fogo', { area: { tipo: 'circulo', raioMetros: 4 }, alcanceMetros: 10 }));
    expect(tags).toContain('magica');
    expect(tags).toContain('area');
    expect(tags).toContain('dano');
    expect(tags).toContain('projetil');
    expect(tags).not.toContain('unico');
  });

  it('modificador incompatível é recusado com motivo legível', () => {
    const p = ficha([['fogo', 20]]);
    const av = avaliarModificador(p, skill('fogo'), 'expansao_concentrica');
    expect(av.compativel).toBe(false);
    expect(av.motivo).toMatch(/Área/);
  });

  it('o custo dos modificadores é MULTIPLICATIVO', () => {
    const p = ficha([['fogo', 20]]);
    const prog = calcularProgressao(p);
    const base = calcularSkill(p, prog, skill('fogo'));
    const um = calcularSkill(p, prog, skill('fogo', { modificadores: ['sobrecarga_bruta'] }));
    const dois = calcularSkill(
      p,
      prog,
      skill('fogo', { modificadores: ['sobrecarga_bruta', 'canalizacao_arriscada'] }),
    );
    const r1 = um.custoTotal / base.custoTotal;
    const r2 = dois.custoTotal / base.custoTotal;
    // 1.45 × 1.28 = 1.856, não 1.45 + 0.28 = 1.73
    expect(r2).toBeCloseTo(1.45 * 1.28, 2);
    expect(r2).toBeGreaterThan(r1);
  });

  it('o teto anti-composição grampeia o produto de multiplicadores', () => {
    const p = ficha([['fogo', 20]]);
    investirTalento(p, 'engenho_de_skill', 3);
    const prog = calcularProgressao(p);
    const r = calcularSkill(
      p,
      prog,
      skill('fogo', {
        area: { tipo: 'circulo', raioMetros: 4 },
        modificadores: [
          'sobrecarga_bruta',
          'canalizacao_arriscada',
          'gatilho_atrasado',
          'concentracao',
          'ressonancia_ampliada',
        ],
      }),
    );
    expect(r.tetoModificadoresAtingido).toBe(true);
    expect(r.multModificadores).toBeLessThanOrEqual(2.2);
  });

  it('slots limitam quantos modificadores cabem, e Engenho de Skill abre mais', () => {
    const p = ficha([['fogo', 20]]);
    expect(slotsModificador(p)).toBe(2);
    investirTalento(p, 'engenho_de_skill', 2);
    expect(slotsModificador(p)).toBe(4);

    const semSlots = ficha([['fogo', 20]]);
    const prog = calcularProgressao(semSlots);
    const r = calcularSkill(
      semSlots,
      prog,
      skill('fogo', {
        modificadores: ['sobrecarga_bruta', 'canalizacao_arriscada', 'gatilho_atrasado'],
      }),
    );
    expect(r.valida).toBe(false);
    expect(r.erros.some((e) => e.includes('slots'))).toBe(true);
  });

  it('Contenção Disciplinada é a troca negativa: menos poder, muito menos custo', () => {
    const p = ficha([['fogo', 20]]);
    const prog = calcularProgressao(p);
    const base = calcularSkill(p, prog, skill('fogo'));
    const contido = calcularSkill(p, prog, skill('fogo', { modificadores: ['contencao_disciplinada'] }));
    expect(contido.impactoTotal).toBeLessThan(base.impactoTotal);
    expect(contido.custoTotal).toBeLessThan(base.custoTotal);
    expect(contido.impactoTotal / contido.custoTotal).toBeGreaterThan(
      base.impactoTotal / base.custoTotal,
    );
  });
});
