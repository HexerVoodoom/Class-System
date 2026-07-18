import { describe, expect, it } from 'vitest';
import {
  criarPersonagem,
  investirElemento,
  investirEscola,
  investirRecurso,
  investirTalento,
  type Personagem,
} from '../src/engine/personagem';
import { calcularProgressao } from '../src/engine/progressao';
import { calcularSkill, type SkillConfig } from '../src/engine/skills';

function magoBase(): Personagem {
  const p = criarPersonagem('mago');
  investirElemento(p, 'fogo', 12);
  investirElemento(p, 'terra', 12);
  investirEscola(p, 'conjuracao', 10);
  investirEscola(p, 'evocacao', 10);
  investirRecurso(p, 'mana', 5);
  return p;
}

function skillBase(extra: Partial<SkillConfig> = {}): SkillConfig {
  return {
    nome: 'teste',
    elemento: 'fogo',
    escola: 'conjuracao',
    fontes: [{ recurso: 'mana', proporcao: 100 }],
    energia: 20,
    tempoConjuracaoSegundos: 1,
    alcanceMetros: 10,
    area: { tipo: 'unico' },
    entrega: { tipo: 'instantaneo' },
    ...extra,
  };
}

describe('validação', () => {
  it('rejeita elemento não liberado', () => {
    const p = magoBase();
    const prog = calcularProgressao(p);
    const r = calcularSkill(p, prog, skillBase({ elemento: 'morte' }));
    expect(r.valida).toBe(false);
    expect(r.erros.join(' ')).toMatch(/não foi liberado/);
  });

  it('aceita elemento derivado liberado (lava)', () => {
    const p = magoBase();
    const prog = calcularProgressao(p);
    expect(prog.niveisEfetivos.lava).toBeGreaterThan(0);
    const r = calcularSkill(p, prog, skillBase({ elemento: 'lava' }));
    expect(r.valida).toBe(true);
  });

  it('rejeita energia acima do limite e raio acima do máximo', () => {
    const p = magoBase();
    const prog = calcularProgressao(p);
    const r1 = calcularSkill(p, prog, skillBase({ energia: 999 }));
    expect(r1.valida).toBe(false);
    const r2 = calcularSkill(
      p,
      prog,
      skillBase({ area: { tipo: 'circulo', raioMetros: 20 } }),
    );
    expect(r2.valida).toBe(false);
  });

  it('talentos ampliam os limites', () => {
    const p = magoBase();
    investirTalento(p, 'area_ampliada', 5); // +10m de raio
    const prog = calcularProgressao(p);
    const r = calcularSkill(
      p,
      prog,
      skillBase({ area: { tipo: 'circulo', raioMetros: 14 } }),
    );
    expect(r.valida).toBe(true);
  });

  it('capacidade de arquétipo bloqueia quem não a tem', () => {
    const p = magoBase();
    const prog = calcularProgressao(p);
    const r = calcularSkill(
      p,
      prog,
      skillBase({ capacidadeExigida: 'evocar_demonios_mortos' }),
    );
    expect(r.valida).toBe(false);
  });
});

describe('alavancas de resultado', () => {
  it('mais energia = mais impacto', () => {
    const p = magoBase();
    const prog = calcularProgressao(p);
    const fraco = calcularSkill(p, prog, skillBase({ energia: 10 }));
    const forte = calcularSkill(p, prog, skillBase({ energia: 30 }));
    expect(forte.impactoTotal).toBeGreaterThan(fraco.impactoTotal);
  });

  it('mais tempo de conjuração = mais impacto', () => {
    const p = magoBase();
    const prog = calcularProgressao(p);
    const rapido = calcularSkill(p, prog, skillBase({ tempoConjuracaoSegundos: 1 }));
    const lento = calcularSkill(p, prog, skillBase({ tempoConjuracaoSegundos: 4 }));
    expect(lento.impactoTotal).toBeCloseTo(rapido.impactoTotal * 2, 5);
  });
});

describe('balanceamento: formas diferentes, impacto similar', () => {
  it('área espalha o orçamento: total similar, por alvo menor', () => {
    const p = magoBase();
    investirTalento(p, 'area_ampliada', 3);
    const prog = calcularProgressao(p);
    const unico = calcularSkill(p, prog, skillBase());
    const area = calcularSkill(
      p,
      prog,
      skillBase({ area: { tipo: 'circulo', raioMetros: 6 } }),
    );
    // total dentro de ±15% (taxa de área), por alvo bem menor
    expect(area.impactoTotal / unico.impactoTotal).toBeGreaterThan(0.85);
    expect(area.impactoTotal / unico.impactoTotal).toBeLessThanOrEqual(1);
    expect(area.impactoPorAlvo).toBeLessThan(unico.impactoPorAlvo / 2);
  });

  it('DoT rende um pouco mais no total, diluído na duração', () => {
    const p = magoBase();
    const prog = calcularProgressao(p);
    const burst = calcularSkill(p, prog, skillBase());
    const dot = calcularSkill(
      p,
      prog,
      skillBase({ entrega: { tipo: 'continuo', duracaoSegundos: 10 } }),
    );
    expect(dot.impactoTotal).toBeGreaterThan(burst.impactoTotal);
    expect(dot.impactoTotal).toBeLessThanOrEqual(burst.impactoTotal * 1.3);
    expect(dot.impactoPorSegundo).toBeCloseTo(dot.impactoTotal / 10, 5);
  });

  it('enxame vs colosso: poder total similar, distribuição oposta', () => {
    const enxamado = magoBase();
    investirTalento(enxamado, 'enxame', 3);
    const colossal = magoBase();
    investirTalento(colossal, 'colosso', 3);

    const cfg = skillBase({ escola: 'evocacao', tempoConjuracaoSegundos: 2 });
    const rEnxame = calcularSkill(enxamado, calcularProgressao(enxamado), cfg);
    const rColosso = calcularSkill(colossal, calcularProgressao(colossal), cfg);

    expect(rEnxame.invocacoes!.quantidade).toBe(4);
    expect(rColosso.invocacoes!.quantidade).toBe(1);
    expect(rColosso.invocacoes!.poderPorCriatura).toBeGreaterThan(
      rEnxame.invocacoes!.poderPorCriatura * 3,
    );
    // orçamentos totais dentro de ±25% um do outro
    const razao = rEnxame.invocacoes!.poderTotal / rColosso.invocacoes!.poderTotal;
    expect(razao).toBeGreaterThan(0.75);
    expect(razao).toBeLessThan(1.25);
  });

  it('eficiência (impacto/energia) é estável entre configurações', () => {
    const p = magoBase();
    investirTalento(p, 'area_ampliada', 3);
    const prog = calcularProgressao(p);
    const configs: SkillConfig[] = [
      skillBase({ energia: 10 }),
      skillBase({ energia: 30 }),
      skillBase({ energia: 20, area: { tipo: 'circulo', raioMetros: 5 } }),
      skillBase({ energia: 20, entrega: { tipo: 'continuo', duracaoSegundos: 5 } }),
    ];
    const eficiencias = configs.map((c) => calcularSkill(p, prog, c).eficiencia);
    const max = Math.max(...eficiencias);
    const min = Math.min(...eficiencias);
    expect(max / min).toBeLessThan(1.35);
  });

  it('fontes combinadas dividem o custo na proporção escolhida', () => {
    const p = magoBase();
    investirRecurso(p, 'furia', 5);
    const prog = calcularProgressao(p);
    const r = calcularSkill(
      p,
      prog,
      skillBase({
        fontes: [
          { recurso: 'mana', proporcao: 60 },
          { recurso: 'furia', proporcao: 40 },
        ],
      }),
    );
    expect(r.valida).toBe(true);
    expect(r.custoPorFonte).toHaveLength(2);
    const mana = r.custoPorFonte.find((c) => c.recurso === 'mana')!;
    const furia = r.custoPorFonte.find((c) => c.recurso === 'furia')!;
    expect(mana.custo / furia.custo).toBeCloseTo(60 / 40, 5);
    expect(mana.custo + furia.custo).toBeCloseTo(r.custoTotal, 5);
  });

  it('fonte sem proficiência invalida a skill', () => {
    const p = magoBase(); // só tem mana
    const prog = calcularProgressao(p);
    const r = calcularSkill(
      p,
      prog,
      skillBase({ fontes: [{ recurso: 'furia', proporcao: 100 }] }),
    );
    expect(r.valida).toBe(false);
    expect(r.erros.join(' ')).toMatch(/Sem proficiência em Fúria/);
  });

  it('mais proficiência na fonte: custo menor, impacto maior, conjuração mínima menor', () => {
    const novato = magoBase(); // mana 5
    const mestre = magoBase();
    investirRecurso(mestre, 'mana', 15); // mana 20
    const cfg = skillBase();
    const rNovato = calcularSkill(novato, calcularProgressao(novato), cfg);
    const rMestre = calcularSkill(mestre, calcularProgressao(mestre), cfg);
    expect(rMestre.custoTotal).toBeLessThan(rNovato.custoTotal);
    expect(rMestre.impactoTotal).toBeGreaterThan(rNovato.impactoTotal);
    expect(rMestre.limites.tempoConjuracaoMinimo).toBeLessThan(
      rNovato.limites.tempoConjuracaoMinimo,
    );
  });

  it('soullink parcial amplifica o poder na proporção da mistura', () => {
    const p = magoBase();
    investirRecurso(p, 'soullink', 5);
    const prog = calcularProgressao(p);
    const puroMana = calcularSkill(p, prog, skillBase());
    const misto = calcularSkill(
      p,
      prog,
      skillBase({
        fontes: [
          { recurso: 'mana', proporcao: 50 },
          { recurso: 'soullink', proporcao: 50 },
        ],
      }),
    );
    // multFontes = 0.5×1.0 + 0.5×1.3 = 1.15, mas a proficiência ponderada
    // muda (mana 5 / soullink 5 → mesma média), então razão ≈ 1.15
    expect(misto.impactoTotal / puroMana.impactoTotal).toBeCloseTo(1.15, 2);
  });

  it('alcance maior encarece a skill e é limitado por talento', () => {
    const p = magoBase();
    const prog = calcularProgressao(p);
    const curto = calcularSkill(p, prog, skillBase({ alcanceMetros: 0 }));
    const longo = calcularSkill(p, prog, skillBase({ alcanceMetros: 20 }));
    expect(longo.custoTotal).toBeGreaterThan(curto.custoTotal);
    const invalido = calcularSkill(p, prog, skillBase({ alcanceMetros: 30 }));
    expect(invalido.valida).toBe(false);
    investirTalento(p, 'alcance_estendido', 2); // +10m
    const r = calcularSkill(p, calcularProgressao(p), skillBase({ alcanceMetros: 30 }));
    expect(r.valida).toBe(true);
  });

  it('elementos derivados pagam melhor por nível (fator de potência)', () => {
    const p = magoBase();
    const prog = calcularProgressao(p);
    // lava tem nível 12 (min de fogo/terra) e fator 1.15
    const fogo = calcularSkill(p, prog, skillBase({ elemento: 'fogo' }));
    const lava = calcularSkill(p, prog, skillBase({ elemento: 'lava' }));
    expect(lava.impactoTotal).toBeGreaterThan(fogo.impactoTotal);
  });
});
