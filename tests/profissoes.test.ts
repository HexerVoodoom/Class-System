import { describe, expect, it } from 'vitest';
import {
  criarPersonagem,
  investirElemento,
  investirEscola,
  investirProfissao,
  investirTalento,
  capturarCriatura,
} from '../src/engine/personagem';
import { calcularProgressao } from '../src/engine/progressao';
import { craftar, elementosDominados, tierDe, type ConfigCraft } from '../src/engine/profissoes';
import { itensDaProfissao } from '../src/registry/profissoes';

function ferreiro(nivel = 10): ReturnType<typeof criarPersonagem> {
  const p = criarPersonagem('Durin');
  investirProfissao(p, 'ferreiro', nivel);
  investirElemento(p, 'vida', 12);
  investirElemento(p, 'marcial', 12);
  investirElemento(p, 'marcial', 10);
  return p;
}

describe('profissão e qualidade', () => {
  it('exige investir na profissão', () => {
    const p = criarPersonagem('t');
    const r = craftar(p, calcularProgressao(p), { profissao: 'ferreiro', itemId: 'espada', elementosImbuidos: [] });
    expect(r.valida).toBe(false);
    expect(r.erros.join(' ')).toMatch(/Invista pontos na profissão/);
  });

  it('mais nível de profissão e atributos → mais qualidade e tier melhor', () => {
    const novato = ferreiro(2);
    const mestre = ferreiro(15);
    const rN = craftar(novato, calcularProgressao(novato), { profissao: 'ferreiro', itemId: 'espada', elementosImbuidos: [] });
    const rM = craftar(mestre, calcularProgressao(mestre), { profissao: 'ferreiro', itemId: 'espada', elementosImbuidos: [] });
    expect(rM.qualidade).toBeGreaterThan(rN.qualidade);
    expect(TIERS_INDEX(rM.tier.nome)).toBeGreaterThanOrEqual(TIERS_INDEX(rN.tier.nome));
  });

  it('item precisa pertencer à profissão', () => {
    const p = ferreiro();
    const r = craftar(p, calcularProgressao(p), { profissao: 'ferreiro', itemId: 'pocao', elementosImbuidos: [] });
    expect(r.valida).toBe(false);
    expect(r.erros.join(' ')).toMatch(/não pertence/);
  });

  it('tierDe respeita os limiares', () => {
    expect(tierDe(0).nome).toBe('Comum');
    expect(tierDe(50).nome).toBe('Raro');
    expect(tierDe(200).nome).toBe('Mítico');
  });
});

function TIERS_INDEX(nome: string): number {
  return ['Comum', 'Incomum', 'Raro', 'Épico', 'Lendário', 'Mítico'].indexOf(nome);
}

describe('propriedades emergentes (a ficha molda o item)', () => {
  it('fogo + frio (água) → Têmpera Perfeita no aço', () => {
    const p = ferreiro();
    investirElemento(p, 'fogo', 10);
    investirElemento(p, 'agua', 10);
    const prog = calcularProgressao(p);
    const r = craftar(p, prog, { profissao: 'ferreiro', itemId: 'espada', elementosImbuidos: ['fogo', 'agua'] });
    expect(r.valida).toBe(true);
    expect(r.propriedades.map((x) => x.id)).toContain('tempera_perfeita');
    expect(r.nomeItem).toMatch(/Têmpera Perfeita/);
  });

  it('sem imbuir os dois, a têmpera não emerge', () => {
    const p = ferreiro();
    investirElemento(p, 'fogo', 10);
    investirElemento(p, 'agua', 10);
    const prog = calcularProgressao(p);
    const r = craftar(p, prog, { profissao: 'ferreiro', itemId: 'espada', elementosImbuidos: ['fogo'] });
    expect(r.propriedades.map((x) => x.id)).not.toContain('tempera_perfeita');
    expect(r.propriedades.map((x) => x.id)).toContain('flamejante'); // mas o fogo dá flamejante
  });

  it('veneno → adaga envenenada', () => {
    const p = ferreiro();
    investirElemento(p, 'agua', 12);
    investirElemento(p, 'morte', 12); // veneno = agua+morte, dominado
    const prog = calcularProgressao(p);
    expect(elementosDominados(prog)).toContain('veneno');
    const r = craftar(p, prog, { profissao: 'ferreiro', itemId: 'adaga', elementosImbuidos: ['veneno'] });
    expect(r.propriedades.map((x) => x.id)).toContain('envenenada');
  });

  it('gravidade/espaço → machado flutuante', () => {
    const p = ferreiro();
    investirElemento(p, 'gravidade', 10);
    const prog = calcularProgressao(p);
    const r = craftar(p, prog, { profissao: 'ferreiro', itemId: 'machado', elementosImbuidos: ['gravidade'] });
    expect(r.propriedades.map((x) => x.id)).toContain('flutuante');
    expect(r.nomeItem).toMatch(/Flutuante/);
  });

  it('imbuir sem maestria é rejeitado', () => {
    // sem UM ponto sequer em fogo: mesmo o transbordo da ficha do ferreiro
    // (vida+marcial) não chega ao limiar de maestria
    const p = ferreiro();
    const prog = calcularProgressao(p);
    const r = craftar(p, prog, { profissao: 'ferreiro', itemId: 'espada', elementosImbuidos: ['fogo'] });
    expect(r.valida).toBe(false);
    expect(r.erros.join(' ')).toMatch(/Sem maestria/);
  });

  it('Obra-Prima só aparece com profissão alta', () => {
    const humilde = ferreiro(5);
    const mestre = ferreiro(14);
    const cfg: ConfigCraft = { profissao: 'ferreiro', itemId: 'espada', elementosImbuidos: [] };
    expect(craftar(humilde, calcularProgressao(humilde), cfg).propriedades.map((x) => x.id)).not.toContain('obra_prima');
    expect(craftar(mestre, calcularProgressao(mestre), cfg).propriedades.map((x) => x.id)).toContain('obra_prima');
  });

  it('propriedade respeita a categoria do item (regenerativa só em armadura/acessório)', () => {
    const p = ferreiro();
    investirElemento(p, 'vida', 12);
    const prog = calcularProgressao(p);
    const arma = craftar(p, prog, { profissao: 'ferreiro', itemId: 'espada', elementosImbuidos: ['vida'] });
    const armadura = craftar(p, prog, { profissao: 'ferreiro', itemId: 'peitoral', elementosImbuidos: ['vida'] });
    expect(arma.propriedades.map((x) => x.id)).not.toContain('regenerativa');
    expect(armadura.propriedades.map((x) => x.id)).toContain('regenerativa');
  });

  it('cada profissão só lista seus próprios itens', () => {
    expect(itensDaProfissao('alquimista').every((i) => i.categoria === 'consumivel')).toBe(true);
    expect(itensDaProfissao('ferreiro').map((i) => i.id)).toContain('espada');
  });
});

describe('ponte bestiário → curtidor (peles de criatura)', () => {
  function curtidor(): ReturnType<typeof criarPersonagem> {
    const p = criarPersonagem('Peleiro');
    investirProfissao(p, 'curtidor', 10);
    investirElemento(p, 'vida', 12);
    investirElemento(p, 'vida', 12);
    investirElemento(p, 'marcial', 12);
    return p;
  }

  it('couro de dragão confere a propriedade Dracônica e muito poder', () => {
    const p = curtidor();
    investirElemento(p, 'fogo', 12);
    investirElemento(p, 'arcano', 12); // afinidade p/ capturar dragão jovem (fogo/arcano)
    investirEscola(p, 'evocacao', 12);
    investirTalento(p, 'instinto_de_caca', 3);
    const prog = calcularProgressao(p);
    capturarCriatura(p, prog, 'dragao_jovem');
    const semMaterial = craftar(p, prog, { profissao: 'curtidor', itemId: 'armadura_couro', elementosImbuidos: [] });
    const comMaterial = craftar(p, prog, {
      profissao: 'curtidor',
      itemId: 'armadura_couro',
      elementosImbuidos: [],
      materialCriaturaId: 'dragao_jovem',
    });
    expect(comMaterial.valida).toBe(true);
    expect(comMaterial.propriedades.map((x) => x.id)).toContain('mat_draconico');
    expect(comMaterial.qualidade).toBeGreaterThan(semMaterial.qualidade + 20);
    expect(comMaterial.nomeItem).toMatch(/Dracônica/);
  });

  it('só o Curtidor trabalha peles', () => {
    const p = criarPersonagem('Ferrufino');
    investirProfissao(p, 'ferreiro', 10);
    investirElemento(p, 'vida', 12);
    investirEscola(p, 'evocacao', 10);
    const prog = calcularProgressao(p);
    capturarCriatura(p, prog, 'lobo');
    const r = craftar(p, prog, { profissao: 'ferreiro', itemId: 'peitoral', elementosImbuidos: [], materialCriaturaId: 'lobo' });
    expect(r.valida).toBe(false);
    expect(r.erros.join(' ')).toMatch(/Só o Curtidor/);
  });

  it('precisa ter a criatura capturada', () => {
    const p = curtidor();
    const prog = calcularProgressao(p);
    const r = craftar(p, prog, { profissao: 'curtidor', itemId: 'armadura_couro', elementosImbuidos: [], materialCriaturaId: 'urso' });
    expect(r.valida).toBe(false);
    expect(r.erros.join(' ')).toMatch(/Capture .* antes/);
  });

  it('propriedade do material respeita a categoria do item', () => {
    const p = curtidor();
    investirElemento(p, 'sombra', 8);
    investirEscola(p, 'evocacao', 10);
    const prog = calcularProgressao(p);
    capturarCriatura(p, prog, 'lobo'); // besta → couro rústico "Resistente" (só armadura)
    // aljava é acessório → propriedade de armadura não aplica, mas ainda soma qualidade do material
    const aljava = craftar(p, prog, { profissao: 'curtidor', itemId: 'aljava', elementosImbuidos: [], materialCriaturaId: 'lobo' });
    expect(aljava.propriedades.map((x) => x.id)).not.toContain('mat_besta');
    const botas = craftar(p, prog, { profissao: 'curtidor', itemId: 'botas', elementosImbuidos: [], materialCriaturaId: 'lobo' });
    expect(botas.propriedades.map((x) => x.id)).toContain('mat_besta');
  });
});
