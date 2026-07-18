import { describe, expect, it } from 'vitest';
import {
  ELEMENTOS,
  elementosBase,
  elementosDerivados,
  type ElementoBaseId,
} from '../src/registry/elementos';
import {
  criarPersonagem,
  investirElemento,
  investirEscola,
  investirRecurso,
  investirTalento,
} from '../src/engine/personagem';
import { calcularProgressao } from '../src/engine/progressao';
import { calcularSkill, type SkillConfig } from '../src/engine/skills';

describe('matriz completa de combinações', () => {
  it('TODOS os 66 pares de elementos base têm um derivado registrado', () => {
    const bases = elementosBase().map((e) => e.id as ElementoBaseId);
    const paresRegistrados = new Set(
      elementosDerivados()
        .filter((d) => d.receita!.length === 2)
        .map((d) =>
          d
            .receita!.map((c) => c.elemento)
            .sort()
            .join('+'),
        ),
    );
    const faltando: string[] = [];
    for (let i = 0; i < bases.length; i++) {
      for (let j = i + 1; j < bases.length; j++) {
        const chave = [bases[i], bases[j]].sort().join('+');
        if (!paresRegistrados.has(chave)) faltando.push(chave);
      }
    }
    expect(faltando).toEqual([]);
    expect(paresRegistrados.size).toBe(78); // C(13,2) com marcial incluído
  });

  it('derivados herdam perfil como média dos componentes', () => {
    const lava = ELEMENTOS.lava;
    const fogo = ELEMENTOS.fogo;
    const terra = ELEMENTOS.terra;
    expect(lava.pesos.dano).toBeCloseTo((fogo.pesos.dano + terra.pesos.dano) / 2, 10);
    expect(lava.pesos.defesa).toBeCloseTo((fogo.pesos.defesa + terra.pesos.defesa) / 2, 10);
  });

  it('triplas e amplas existem (chama demoníaca, primordial, ciclo, nulo)', () => {
    expect(ELEMENTOS.chama_demoniaca.receita).toHaveLength(3);
    expect(ELEMENTOS.primordial.receita).toHaveLength(5);
    expect(ELEMENTOS.ciclo.receita).toHaveLength(4);
    expect(ELEMENTOS.nulo.receita).toHaveLength(13);
  });

  it('primordial: 12+ em todos os primais libera o elemento', () => {
    const p = criarPersonagem('t');
    for (const primal of ['fogo', 'agua', 'terra', 'ar', 'eletricidade'] as const) {
      investirElemento(p, primal, 12);
    }
    expect(calcularProgressao(p).niveisEfetivos.primordial).toBe(12);
  });
});

describe('arquétipos por elemento derivado', () => {
  it('lava + conjuração → lavamante', () => {
    const p = criarPersonagem('t');
    investirElemento(p, 'fogo', 12);
    investirElemento(p, 'terra', 12);
    investirEscola(p, 'conjuracao', 10);
    const prog = calcularProgressao(p);
    expect(prog.arquetipos.map((x) => x.id)).toContain('lavamante');
    expect(prog.capacidades.has('conjurar_erupcao')).toBe(true);
  });

  it('santidade + bênção → santo guardião', () => {
    const p = criarPersonagem('t');
    investirElemento(p, 'luz', 12);
    investirElemento(p, 'vida', 12);
    investirEscola(p, 'benca', 12);
    expect(calcularProgressao(p).capacidades.has('cura_sagrada')).toBe(true);
  });

  it('nulo → portador do nulo, sem exigir escola', () => {
    const p = criarPersonagem('t');
    for (const e of elementosBase()) investirElemento(p, e.id as ElementoBaseId, 8);
    const prog = calcularProgressao(p);
    expect(prog.arquetipos.map((x) => x.id)).toContain('portador_do_nulo');
  });
});

describe('elemento marcial', () => {
  it('marcial + vigor → maestria, com sinergia mútua', () => {
    const p = criarPersonagem('t');
    investirElemento(p, 'marcial', 12);
    investirElemento(p, 'vigor', 10);
    const prog = calcularProgressao(p);
    // vigor efetivo 10 + floor(12*0.1) = 11; maestria = min(12, 11)
    expect(prog.niveisEfetivos.vigor).toBe(11);
    expect(prog.niveisEfetivos.maestria).toBe(11);
  });

  it('marcial + combate físico → mestre de armas', () => {
    const p = criarPersonagem('t');
    investirElemento(p, 'marcial', 12);
    investirEscola(p, 'combate_fisico', 10);
    expect(calcularProgressao(p).capacidades.has('maestria_de_armas')).toBe(true);
  });

  it('arsenal (marcial+arcano) + evocação → arsenal arcano', () => {
    const p = criarPersonagem('t');
    investirElemento(p, 'marcial', 12);
    investirElemento(p, 'arcano', 12);
    investirEscola(p, 'evocacao', 10);
    const prog = calcularProgressao(p);
    expect(prog.niveisEfetivos.arsenal).toBe(12);
    expect(prog.capacidades.has('evocar_arsenal_arcano')).toBe(true);
  });
});

describe('recursos soullink e ressonância na calculadora', () => {
  it('soullink amplifica o poder da mesma skill em relação à mana', () => {
    const p = criarPersonagem('t');
    investirElemento(p, 'marcial', 12);
    investirEscola(p, 'combate_fisico', 10);
    const prog = calcularProgressao(p);
    const base: SkillConfig = {
      nome: 't',
      elemento: 'marcial',
      escola: 'combate_fisico',
      fontes: [{ recurso: 'mana', proporcao: 100 }],
      energia: 20,
      tempoConjuracaoSegundos: 1,
      alcanceMetros: 0,
      area: { tipo: 'unico' },
      entrega: { tipo: 'instantaneo' },
    };
    const comMana = calcularSkill(p, prog, base);
    const comVida = calcularSkill(p, prog, {
      ...base,
      fontes: [{ recurso: 'soullink', proporcao: 100 }],
    });
    expect(comVida.impactoTotal).toBeCloseTo(comMana.impactoTotal * 1.3, 5);
    expect(comVida.propriedades.map((x) => x.chave)).toContain('custo_em_vida');
  });

  it('ressonância começa no poder base e anuncia o teto', () => {
    const p = criarPersonagem('t');
    investirElemento(p, 'fogo', 10);
    investirEscola(p, 'conjuracao', 10);
    const prog = calcularProgressao(p);
    const base: SkillConfig = {
      nome: 't',
      elemento: 'fogo',
      escola: 'conjuracao',
      fontes: [{ recurso: 'ressonancia', proporcao: 100 }],
      energia: 20,
      tempoConjuracaoSegundos: 1,
      alcanceMetros: 0,
      area: { tipo: 'unico' },
      entrega: { tipo: 'instantaneo' },
    };
    const r = calcularSkill(p, prog, base);
    const comMana = calcularSkill(p, prog, {
      ...base,
      fontes: [{ recurso: 'mana', proporcao: 100 }],
    });
    expect(r.impactoTotal).toBeCloseTo(comMana.impactoTotal, 5); // baseline fraco
    expect(r.propriedades.map((x) => x.chave)).toContain('ressonancia_maxima');
  });
});

describe('talentos de recurso e propriedades', () => {
  it('devoção exige proficiência em fé', () => {
    const p = criarPersonagem('t');
    expect(() => investirTalento(p, 'devocao', 1)).toThrow(/proficiência/);
    investirRecurso(p, 'fe', 5);
    investirTalento(p, 'devocao', 2);
    expect(p.talentos.devocao).toBe(2);
  });

  it('propriedades de talento aparecem só na escola certa', () => {
    const p = criarPersonagem('t');
    investirElemento(p, 'fogo', 10);
    investirEscola(p, 'conjuracao', 10);
    investirEscola(p, 'maldicao', 10);
    investirTalento(p, 'perfuracao', 2);
    const prog = calcularProgressao(p);
    const base: SkillConfig = {
      nome: 't',
      elemento: 'fogo',
      escola: 'conjuracao',
      fontes: [{ recurso: 'mana', proporcao: 100 }],
      energia: 10,
      tempoConjuracaoSegundos: 1,
      alcanceMetros: 0,
      area: { tipo: 'unico' },
      entrega: { tipo: 'instantaneo' },
    };
    const conj = calcularSkill(p, prog, base);
    expect(conj.propriedades.map((x) => x.chave)).toContain('penetracao_defesa');
    expect(conj.propriedades.find((x) => x.chave === 'penetracao_defesa')!.valor).toBeCloseTo(0.2);

    const mald = calcularSkill(p, prog, { ...base, escola: 'maldicao' });
    expect(mald.propriedades.map((x) => x.chave)).not.toContain('penetracao_defesa');
  });

  it('ramos exclusivos: perfuração bloqueia estilhaço', () => {
    const p = criarPersonagem('t');
    investirEscola(p, 'conjuracao', 10);
    investirTalento(p, 'perfuracao', 1);
    expect(() => investirTalento(p, 'estilhaco', 1)).toThrow(/exclusivo/);
  });

  it('perfil da skill soma o impacto total', () => {
    const p = criarPersonagem('t');
    investirElemento(p, 'agua', 12);
    investirEscola(p, 'maldicao', 10);
    const prog = calcularProgressao(p);
    const r = calcularSkill(p, prog, {
      nome: 't',
      elemento: 'agua',
      escola: 'maldicao',
      fontes: [{ recurso: 'mana', proporcao: 100 }],
      energia: 20,
      tempoConjuracaoSegundos: 1,
      alcanceMetros: 0,
      area: { tipo: 'unico' },
      entrega: { tipo: 'instantaneo' },
    });
    const soma = Object.values(r.perfil).reduce((a, b) => a + b, 0);
    expect(soma).toBeCloseTo(r.impactoTotal, 6);
    // água+maldição pende para controle
    expect(r.perfil.controle).toBeGreaterThan(r.perfil.cura);
  });
});
