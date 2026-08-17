export * from './registry/elementos';
export * from './registry/recursos';
export * from './registry/escolas';
export * from './registry/talentos';
export * from './registry/arquetipos';
export * from './registry/criaturas';
export * from './registry/afinidades';
export * from './registry/estados';
export * from './registry/profissoes';
export * from './engine/profissoes';
export * from './engine/personagem';
export * from './engine/progressao';
export * from './registry/formatos';
export * from './registry/presets';
export * from './engine/presets';
export * from './engine/skills';
export * from './engine/recursos';
export * from './engine/evocacao';
// Camada 10 — o espaço completo de combinações de 3 e 4 elementos
export * from './registry/combinacoes';
// Camada 11 — modificadores de skill e fusão de 2ª/3ª geração
export * from './registry/modificadores';
export * from './engine/fusao';
// A superfície legível por máquina: consultas determinísticas para programas
// e agentes. É por aqui que se entra sem ler o motor inteiro — ver AGENTS.md.
export * from './api/consultas';
