/**
 * Demo: monta três personagens e mostra progressão, desbloqueios e a
 * calculadora de skills em ação. Rode com `npm run demo`.
 */

import {
  criarPersonagem,
  investirElemento,
  investirEscola,
  investirRecurso,
  investirTalento,
} from './engine/personagem';
import { calcularProgressao } from './engine/progressao';
import { calcularSkill, type SkillConfig } from './engine/skills';
import { FeEstado, FuriaEstado } from './engine/recursos';
import { ELEMENTOS } from './registry/elementos';
import type { Personagem } from './engine/personagem';

function mostrarFicha(p: Personagem) {
  const prog = calcularProgressao(p);
  console.log(`\n=== ${p.nome} ===`);
  console.log('Elementos efetivos:');
  for (const id of prog.elementosDisponiveis) {
    const direto = p.elementos[id] ?? 0;
    const extra = prog.niveisEfetivos[id] - direto;
    const origem =
      ELEMENTOS[id].tipo === 'base'
        ? extra > 0
          ? ` (${direto} diretos + ${extra} de sinergia)`
          : ''
        : ' (derivado da receita)';
    console.log(`  ${ELEMENTOS[id].nome}: ${prog.niveisEfetivos[id]}${origem}`);
  }
  if (prog.arquetipos.length) {
    console.log('Arquétipos desbloqueados:');
    for (const a of prog.arquetipos) console.log(`  ★ ${a.nome} — ${a.descricao}`);
  }
  return prog;
}

function mostrarSkill(p: Personagem, cfg: SkillConfig) {
  const prog = calcularProgressao(p);
  const r = calcularSkill(p, prog, cfg);
  console.log(`\n  Skill "${cfg.nome}" [${cfg.elemento} + ${cfg.escola} @ ${cfg.recurso}]`);
  if (!r.valida) {
    for (const e of r.erros) console.log(`    ✗ ${e}`);
    return;
  }
  console.log(
    `    custo ${r.custoBase.toFixed(1)} | orçamento ${r.orcamentoDePoder.toFixed(1)} | ` +
      `impacto total ${r.impactoTotal.toFixed(1)} | por alvo ${r.impactoPorAlvo.toFixed(1)} ` +
      `(${r.alvosEsperados.toFixed(1)} alvos)`,
  );
  if (r.impactoPorSegundo) console.log(`    contínuo: ${r.impactoPorSegundo.toFixed(1)}/s`);
  if (r.invocacoes) {
    console.log(
      `    invoca ${r.invocacoes.quantidade} criatura(s) de poder ${r.invocacoes.poderPorCriatura.toFixed(1)} cada`,
    );
  }
}

// ---------- 1. Necromante clássico ----------
const necro = criarPersonagem('Vesper, a Necromante');
investirElemento(necro, 'morte', 18);
investirElemento(necro, 'sombra', 6);
investirElemento(necro, 'fogo', 14);
investirEscola(necro, 'evocacao', 14);
investirEscola(necro, 'maldicao', 6);
investirRecurso(necro, 'mana', 10);
investirTalento(necro, 'enxame', 3);
mostrarFicha(necro);
mostrarSkill(necro, {
  nome: 'Legião de Ossos',
  elemento: 'morte',
  escola: 'evocacao',
  recurso: 'mana',
  energia: 30,
  tempoConjuracaoSegundos: 3,
  area: { tipo: 'unico' },
  entrega: { tipo: 'instantaneo' },
  capacidadeExigida: 'evocar_mortos_vivos',
});
mostrarSkill(necro, {
  nome: 'Lança de Chama Azul',
  elemento: 'chama_azul',
  escola: 'maldicao',
  recurso: 'mana',
  energia: 20,
  tempoConjuracaoSegundos: 1.5,
  area: { tipo: 'unico' },
  entrega: { tipo: 'continuo', duracaoSegundos: 8 },
});

// ---------- 2. Guerreiro evocador (Arsenal Espectral) ----------
const guerreiro = criarPersonagem('Kael, Arsenal Espectral');
investirElemento(guerreiro, 'vigor', 12);
investirElemento(guerreiro, 'arcano', 8);
investirEscola(guerreiro, 'evocacao', 13);
investirEscola(guerreiro, 'combate_fisico', 13);
investirRecurso(guerreiro, 'furia', 9);
investirTalento(guerreiro, 'colosso', 2);
investirTalento(guerreiro, 'vinculo_marcial', 2);
mostrarFicha(guerreiro);
mostrarSkill(guerreiro, {
  nome: 'Armas Dançantes',
  elemento: 'vigor',
  escola: 'evocacao',
  recurso: 'furia',
  energia: 35,
  tempoConjuracaoSegundos: 2,
  area: { tipo: 'unico' },
  entrega: { tipo: 'instantaneo' },
  capacidadeExigida: 'evocar_armas_autonomas',
});

// ---------- 3. Sacerdotisa da vida (mostra sinergia vida→primais) ----------
const sacerdotisa = criarPersonagem('Ilya, Sacerdotisa Verdejante');
investirElemento(sacerdotisa, 'vida', 25);
investirElemento(sacerdotisa, 'fogo', 8);
investirEscola(sacerdotisa, 'evocacao', 12);
investirEscola(sacerdotisa, 'benca', 8);
investirRecurso(sacerdotisa, 'fe', 8);
investirTalento(sacerdotisa, 'area_ampliada', 3);
mostrarFicha(sacerdotisa);
mostrarSkill(sacerdotisa, {
  nome: 'Jardim Guardião',
  elemento: 'vida',
  escola: 'evocacao',
  recurso: 'fe',
  energia: 24,
  tempoConjuracaoSegundos: 2.5,
  area: { tipo: 'circulo', raioMetros: 6 },
  entrega: { tipo: 'continuo', duracaoSegundos: 10 },
  capacidadeExigida: 'evocar_plantas',
});

// ---------- 4. Dinâmica dos recursos ----------
console.log('\n=== Dinâmica da Fé (custo cresce com uso, decai com descanso) ===');
const fe = new FeEstado(8);
for (let i = 1; i <= 4; i++) {
  console.log(`  uso ${i}: custo efetivo de 20 → ${fe.custoEfetivo(20).toFixed(1)}`);
  fe.usar(20);
  fe.tick(1);
}
fe.tick(40);
console.log(`  após 40s de descanso: custo efetivo de 20 → ${fe.custoEfetivo(20).toFixed(1)}`);

console.log('\n=== Dinâmica da Fúria (gerada em combate, decai fora) ===');
const furia = new FuriaEstado(5);
furia.aoCausarDano(60);
furia.aoReceberDano(40);
console.log(`  após causar 60 e receber 40 de dano: fúria = ${furia.atual.toFixed(1)}`);
furia.tick(10);
console.log(`  10s fora de combate: fúria = ${furia.atual.toFixed(1)}`);
