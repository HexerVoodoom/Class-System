import { describe, expect, it } from 'vitest';
import { AFINIDADES } from '../src/registry/afinidades';
import { elementosBase, type ElementoBaseId } from '../src/registry/elementos';
import {
  criarPersonagem,
  investirElemento,
  investirEscola,
  investirRecurso,
} from '../src/engine/personagem';
import { calcularProgressao } from '../src/engine/progressao';
import { calcularSkill, type SkillConfig } from '../src/engine/skills';
import { efetividade, MULT_FORTE, MULT_FRACO, MULT_NEUTRO } from '../src/registry/afinidades';
import { ARQUETIPOS } from '../src/registry/arquetipos';

describe('afinidade elemental (Ragnarok/FF/D&D)', () => {
  it('forte, fraco e neutro têm os multiplicadores esperados', () => {
    expect(efetividade('fogo', 'vida')).toBe(MULT_FORTE); // fogo queima vida
    expect(efetividade('fogo', 'agua')).toBe(MULT_FRACO); // água apaga fogo
    expect(efetividade('fogo', 'sombra')).toBe(MULT_NEUTRO);
  });

  it('elemento derivado herda a afinidade do componente dominante', () => {
    // lava = fogo(0) + terra → dominante fogo → forte vs vida
    expect(efetividade('lava', 'vida')).toBe(MULT_FORTE);
  });

  it('físico (vigor/marcial) é neutro contra tudo, mas fraco vs arcano no defensor', () => {
    expect(efetividade('marcial', 'fogo')).toBe(MULT_NEUTRO);
    expect(efetividade('arcano', 'marcial')).toBe(MULT_FORTE); // arcano penetra físico
  });

  it('a gravidade esmaga o físico e desgasta o vivo; o arcano a dobra', () => {
    // Gravidade absorveu Espaço e Tempo: herdou o que os dois faziam.
    expect(efetividade('gravidade', 'marcial')).toBe(MULT_FORTE);
    expect(efetividade('gravidade', 'vida')).toBe(MULT_FORTE);
    expect(efetividade('arcano', 'gravidade')).toBe(MULT_FORTE);
    expect(efetividade('gravidade', 'arcano')).toBe(MULT_FRACO);
  });

  it('o ciclo elemental não degenerou: todo base tem força e fraqueza', () => {
    // Com 13 bases em vez de 17, a matriz podia virar uma cadeia sem ciclo —
    // um pedra-papel-tesoura em que alguém nunca perde.
    const sem: string[] = [];
    for (const def of elementosBase()) {
      const a = AFINIDADES[def.id as ElementoBaseId];
      if (!a.forteContra.length && def.id !== 'marcial') sem.push(`${def.id}: sem força`);
      if (!a.fracoContra.length && def.id !== 'luz') sem.push(`${def.id}: sem fraqueza`);
    }
    expect(sem).toEqual([]);
  });

  it('a skill reporta a efetividade sem alterar o impacto base', () => {
    const p = criarPersonagem('t');
    investirElemento(p, 'fogo', 12);
    investirEscola(p, 'conjuracao', 10);
    investirRecurso(p, 'mana', 5);
    const prog = calcularProgressao(p);
    const base: SkillConfig = {
      nome: 't',
      elemento: 'fogo',
      escola: 'conjuracao',
      fontes: [{ recurso: 'mana', proporcao: 100 }],
      energia: 20,
      tempoConjuracaoSegundos: 1,
      alcanceMetros: 0,
      area: { tipo: 'unico' },
      entrega: { tipo: 'instantaneo' },
    };
    const semAlvo = calcularSkill(p, prog, base);
    const vsVida = calcularSkill(p, prog, { ...base, alvoElemento: 'vida' });
    expect(vsVida.impactoTotal).toBe(semAlvo.impactoTotal); // base intacto
    expect(vsVida.efetividade!.multiplicador).toBe(MULT_FORTE);
    expect(vsVida.efetividade!.impacto).toBeCloseTo(semAlvo.impactoTotal * 1.5, 5);
    expect(vsVida.efetividade!.rotulo).toBe('forte');
  });
});

describe('estados/condições (D&D/FF/Ragnarok)', () => {
  function skill(elemento: string, escola: any): SkillConfig {
    return {
      nome: 't',
      elemento,
      escola,
      fontes: [{ recurso: 'mana', proporcao: 100 }],
      energia: 20,
      tempoConjuracaoSegundos: 1,
      alcanceMetros: 0,
      area: { tipo: 'unico' },
      entrega: { tipo: 'instantaneo' },
    };
  }
  function base(elem: string): ReturnType<typeof criarPersonagem> {
    const p = criarPersonagem('t');
    investirElemento(p, elem, 12);
    investirEscola(p, 'conjuracao', 10);
    investirEscola(p, 'maldicao', 10);
    investirRecurso(p, 'mana', 5);
    return p;
  }

  it('fogo conjurado pode causar queimadura', () => {
    const p = base('fogo');
    const r = calcularSkill(p, calcularProgressao(p), skill('fogo', 'conjuracao'));
    expect(r.estados.map((e) => e.id)).toContain('queimadura');
  });

  it('maldição adiciona estados de controle da escola', () => {
    const p = base('agua');
    const r = calcularSkill(p, calcularProgressao(p), skill('agua', 'maldicao'));
    const ids = r.estados.map((e) => e.id);
    // água → congelamento/lentidão; maldição → maldição/veneno/lentidão/silêncio
    expect(ids).toContain('congelamento');
    expect(ids).toContain('veneno');
    expect(ids).toContain('silencio');
  });

  it('elemento derivado usa a base dominante para os estados', () => {
    const p = criarPersonagem('t');
    investirElemento(p, 'agua', 12);
    investirElemento(p, 'ar', 12); // gelo = agua+ar → dominante agua
    investirEscola(p, 'conjuracao', 10);
    investirRecurso(p, 'mana', 5);
    const r = calcularSkill(p, calcularProgressao(p), skill('gelo', 'conjuracao'));
    expect(r.estados.map((e) => e.id)).toContain('congelamento');
  });
});

describe('novas classes (ToS/FF/Ragnarok/WoW/D&D)', () => {
  it('geomante: terra + conjuração', () => {
    const p = criarPersonagem('t');
    investirElemento(p, 'terra', 12);
    investirEscola(p, 'conjuracao', 12);
    const prog = calcularProgressao(p);
    expect(prog.arquetipos.map((x) => x.id)).toContain('geomante');
    expect(prog.capacidades.has('moldar_terreno')).toBe(true);
  });

  it('cavaleiro dragão: esgrima (marcial+ar) + combate físico', () => {
    const p = criarPersonagem('t');
    investirElemento(p, 'marcial', 12);
    investirElemento(p, 'ar', 12); // esgrima = marcial+ar
    investirEscola(p, 'combate_fisico', 12);
    const prog = calcularProgressao(p);
    expect(prog.niveisEfetivos.esgrima).toBeGreaterThanOrEqual(12);
    expect(prog.arquetipos.map((x) => x.id)).toContain('cavaleiro_dragao');
  });

  it('todos os novos arquétipos existem no registro', () => {
    for (const id of ['geomante', 'cronomante', 'bardo', 'alquimista', 'xama_totemico', 'feiticeiro_de_cartas', 'bokor', 'tecelao_de_sangue', 'cavaleiro_dragao', 'cavalaria_negra', 'mago_vermelho', 'cabalista', 'invocador', 'menestrel', 'senhor_da_gravidade', 'astromante', 'viajante_dimensional', 'demiurgo']) {
      expect(ARQUETIPOS[id]).toBeDefined();
    }
  });
});

describe('pressa do Cronomante (Camada 7)', () => {
  it('skill de elemento temporal acelera a conjuração (mais poder que a mesma skill não-temporal)', () => {
    // Tempo virou o par Gravidade+Arcano; a pressa passou a ser detectada
    // pela RECEITA conter os dois, não pela base dominante.
    const p = criarPersonagem('crono');
    investirElemento(p, 'gravidade', 20);
    investirElemento(p, 'arcano', 20);
    investirElemento(p, 'fogo', 20);
    investirEscola(p, 'conjuracao', 10);
    investirRecurso(p, 'mana', 5);
    const prog = calcularProgressao(p);
    const base: SkillConfig = {
      nome: 't',
      elemento: 'fogo',
      escola: 'conjuracao',
      fontes: [{ recurso: 'mana', proporcao: 100 }],
      energia: 20,
      tempoConjuracaoSegundos: 2,
      alcanceMetros: 0,
      area: { tipo: 'unico' },
      entrega: { tipo: 'instantaneo' },
    };
    const semPressa = calcularSkill(p, prog, base);
    const comPressa = calcularSkill(p, prog, { ...base, elemento: 'tempo' });
    expect(comPressa.impactoTotal).toBeGreaterThan(semPressa.impactoTotal);
    expect(comPressa.propriedades.map((x) => x.chave)).toContain('pressa');
  });
});
