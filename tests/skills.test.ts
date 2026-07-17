import { describe, expect, it } from 'vitest';
import {
  criarPersonagem,
  investirElemento,
  investirEscola,
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
  return p;
}

function skillBase(extra: Partial<SkillConfig> = {}): SkillConfig {
  return {
    nome: 'teste',
    elemento: 'fogo',
    escola: 'conjuracao',
    recurso: 'mana',
    energia: 20,
    tempoConjuracaoSegundos: 1,
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

  it('elementos derivados pagam melhor por nível (fator de potência)', () => {
    const p = magoBase();
    const prog = calcularProgressao(p);
    // lava tem nível 12 (min de fogo/terra) e fator 1.15
    const fogo = calcularSkill(p, prog, skillBase({ elemento: 'fogo' }));
    const lava = calcularSkill(p, prog, skillBase({ elemento: 'lava' }));
    expect(lava.impactoTotal).toBeGreaterThan(fogo.impactoTotal);
  });
});
