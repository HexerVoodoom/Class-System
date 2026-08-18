/**
 * CLI do Class System — a porta de entrada para automação.
 *
 *   npx tsx src/api/cli.ts <comando> [opções]
 *
 * Saída JSON por padrão (é o que um programa consome); `--texto` produz a
 * versão legível por humano. Todo comando é determinístico: mesma entrada,
 * mesma saída, byte a byte.
 *
 * Fichas são lidas de arquivo (`--ficha caminho.json`) ou de stdin (`-`), no
 * mesmo formato que o simulador exporta.
 */

import { readFileSync } from 'node:fs';
import { criarPersonagem, type Personagem } from '../engine/personagem';
import type { SkillConfig } from '../engine/skills';
import type { FusaoConfig } from '../engine/fusao';
import {
  analisarFicha,
  arquetiposProximos,
  buscar,
  caminhoParaArquetipo,
  diagnosticarFusao,
  diagnosticarSkill,
  explicarElemento,
  explicarPreset,
  listarArquetipos,
  listarCombinacoes,
  listarModificadores,
  listarPresets,
  listarTalentos,
  modificadoresPara,
  panorama,
  previaDeFusao,
  proximasCombinacoes,
  verificarIntegridade,
} from './consultas';

interface Opcoes {
  _: string[];
  [chave: string]: string | boolean | string[] | undefined;
}

function parseArgs(argv: string[]): Opcoes {
  const o: Opcoes = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const chave = a.slice(2);
      const prox = argv[i + 1];
      if (prox === undefined || prox.startsWith('--')) o[chave] = true;
      else {
        o[chave] = prox;
        i++;
      }
    } else {
      (o._ as string[]).push(a);
    }
  }
  return o;
}

function lerJson<T>(caminho: string): T {
  const bruto = caminho === '-' ? readFileSync(0, 'utf8') : readFileSync(caminho, 'utf8');
  return JSON.parse(bruto) as T;
}

function lerFicha(o: Opcoes): Personagem {
  const caminho = o.ficha as string | undefined;
  if (!caminho) return criarPersonagem('vazia');
  const dados = lerJson<Partial<Personagem>>(caminho);
  const p = criarPersonagem(dados.nome ?? 'importada');
  Object.assign(p, dados);
  p.elementos ??= {};
  p.escolas ??= {};
  p.recursos ??= {};
  p.talentos ??= {};
  p.bestiario ??= [];
  p.profissoes ??= {};
  return p;
}

const num = (o: Opcoes, chave: string, padrao: number): number => {
  const v = o[chave];
  const n = typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : padrao;
};

// ---------------------------------------------------------------------------

const AJUDA = `Class System — CLI

USO
  npx tsx src/api/cli.ts <comando> [opções]

CONSULTAS DO SISTEMA (não precisam de ficha)
  panorama                      Tamanho do sistema em números
  buscar <termo>                Busca em tudo: elementos, talentos, arquétipos…
  explicar <elemento>           Ficha técnica de um elemento (inclusive procedurais)
  integridade                   Verifica consistência interna do conteúdo
  listar <o-que>                arquetipos | talentos | modificadores | combinacoes | presets
  preset <id>                   Ficha completa de uma classe pronta, já materializada

CONSULTAS SOBRE UMA FICHA (--ficha arquivo.json, ou - para stdin)
  analisar                      O que esta ficha é hoje
  proximas                      Combinações mais baratas de alcançar
  arquetipos-proximos           Arquétipos mais baratos de alcançar
  caminho <arquetipo>           Plano de pontos até um arquétipo

SKILLS E FUSÃO (--skill a.json, --skills a.json,b.json)
  skill                         Valida e calcula uma skill
  modificadores                 Quais modificadores cabem nesta skill, e por quê
  previa-fusao                  Que elemento sairia de fundir estas skills
  fusao                         Calcula a fusão completa

OPÇÕES
  --ficha <arq|->    Ficha do personagem em JSON
  --skill <arq>      Configuração de skill em JSON
  --skills <a,b,..>  Componentes de uma fusão
  --limite <n>       Máximo de itens devolvidos
  --offset <n>       Início da paginação
  --aridade <n>      Filtra combinações por número de componentes
  --curadas          Só combinações com nome escrito à mão
  --texto            Saída legível por humano em vez de JSON

EXEMPLOS
  npx tsx src/api/cli.ts panorama
  npx tsx src/api/cli.ts buscar vulcao --texto
  npx tsx src/api/cli.ts explicar lava
  npx tsx src/api/cli.ts proximas --ficha minha.json --limite 5
  npx tsx src/api/cli.ts caminho vulcanologo --ficha minha.json
  npx tsx src/api/cli.ts skill --ficha minha.json --skill fogo.json
`;

function texto(valor: unknown, indent = 0): string {
  const pad = ' '.repeat(indent);
  if (valor === null || valor === undefined) return `${pad}—`;
  if (Array.isArray(valor)) {
    if (!valor.length) return `${pad}(vazio)`;
    return valor.map((v) => (typeof v === 'object' ? texto(v, indent) : `${pad}- ${v}`)).join('\n');
  }
  if (typeof valor === 'object') {
    return Object.entries(valor as Record<string, unknown>)
      .map(([k, v]) => {
        if (v === undefined) return '';
        if (typeof v === 'object' && v !== null) return `${pad}${k}:\n${texto(v, indent + 2)}`;
        return `${pad}${k}: ${typeof v === 'number' ? Math.round(v * 1000) / 1000 : v}`;
      })
      .filter(Boolean)
      .join('\n');
  }
  return `${pad}${valor}`;
}

function emitir(valor: unknown, o: Opcoes): void {
  if (o.texto) console.log(texto(valor));
  else console.log(JSON.stringify(valor, null, 2));
}

export function executar(argv: string[]): number {
  const o = parseArgs(argv);
  const [comando, ...resto] = o._ as string[];
  const limite = num(o, 'limite', 20);
  const offset = num(o, 'offset', 0);

  if (!comando || comando === 'ajuda' || o.help || o.h) {
    console.log(AJUDA);
    return 0;
  }

  try {
    switch (comando) {
      case 'panorama':
        emitir(panorama(), o);
        return 0;

      case 'buscar': {
        const termo = resto.join(' ');
        if (!termo) throw new Error('Informe o termo: `buscar <termo>`.');
        emitir(buscar(termo, limite), o);
        return 0;
      }

      case 'explicar': {
        const id = resto[0];
        if (!id) throw new Error('Informe o elemento: `explicar <id>`.');
        const exp = explicarElemento(id);
        if (!exp) {
          throw new Error(
            `Elemento "${id}" não existe. Use \`buscar ${id}\` para achar o id correto.`,
          );
        }
        emitir(exp, o);
        return 0;
      }

      case 'integridade': {
        const problemas = verificarIntegridade();
        emitir({ problemas, total: problemas.length }, o);
        return problemas.some((p) => p.severidade === 'erro') ? 1 : 0;
      }

      case 'listar': {
        const alvo = resto[0];
        switch (alvo) {
          case 'arquetipos': emitir(listarArquetipos(limite, offset), o); return 0;
          case 'talentos': emitir(listarTalentos(limite, offset), o); return 0;
          case 'modificadores': emitir(listarModificadores(limite, offset), o); return 0;
          case 'presets':
            emitir(
              listarPresets(
                {
                  papel: o.papel ? String(o.papel) : undefined,
                  complexidade: o.complexidade ? num(o, 'complexidade', 0) : undefined,
                },
                limite,
                offset,
              ),
              o,
            );
            return 0;
          case 'combinacoes':
            emitir(
              listarCombinacoes({
                aridade: o.aridade ? num(o, 'aridade', 3) : undefined,
                apenasCuradas: Boolean(o.curadas),
                limite,
                offset,
              }),
              o,
            );
            return 0;
          default:
            throw new Error(
              'Liste um destes: arquetipos, talentos, modificadores, combinacoes.',
            );
        }
      }

      case 'preset': {
        const id = resto[0];
        if (!id) throw new Error('Informe a classe: `preset <id>`. Use `listar presets`.');
        const r = explicarPreset(id);
        if (!r) {
          throw new Error(
            `Preset "${id}" não existe. Use \`listar presets\` para ver os ids.`,
          );
        }
        emitir(r, o);
        return 0;
      }

      case 'analisar':
        emitir(analisarFicha(lerFicha(o), limite), o);
        return 0;

      case 'proximas':
        emitir(
          proximasCombinacoes(lerFicha(o), {
            limite,
            aridades: o.aridade ? [num(o, 'aridade', 3)] : [2, 3, 4],
            apenasCuradas: Boolean(o.curadas),
          }),
          o,
        );
        return 0;

      case 'arquetipos-proximos':
        emitir(arquetiposProximos(lerFicha(o), limite), o);
        return 0;

      case 'caminho': {
        const id = resto[0];
        if (!id) throw new Error('Informe o arquétipo: `caminho <id>`.');
        const plano = caminhoParaArquetipo(lerFicha(o), id);
        if (!plano) {
          throw new Error(
            `Arquétipo "${id}" não existe. Use \`listar arquetipos\` para ver os ids.`,
          );
        }
        emitir(plano, o);
        return 0;
      }

      case 'skill': {
        const caminho = o.skill as string | undefined;
        if (!caminho) throw new Error('Informe a skill: `--skill arquivo.json`.');
        emitir(diagnosticarSkill(lerFicha(o), lerJson<SkillConfig>(caminho)), o);
        return 0;
      }

      case 'modificadores': {
        const caminho = o.skill as string | undefined;
        if (!caminho) throw new Error('Informe a skill: `--skill arquivo.json`.');
        emitir(modificadoresPara(lerFicha(o), lerJson<SkillConfig>(caminho)), o);
        return 0;
      }

      case 'previa-fusao':
      case 'fusao': {
        const lista = o.skills as string | undefined;
        if (!lista) throw new Error('Informe os componentes: `--skills a.json,b.json`.');
        const componentes = lista.split(',').map((c) => lerJson<SkillConfig>(c.trim()));
        const ficha = lerFicha(o);
        if (comando === 'previa-fusao') emitir(previaDeFusao(ficha, componentes), o);
        else {
          const cfg: FusaoConfig = { nome: (o.nome as string) ?? 'Fusão', componentes };
          emitir(diagnosticarFusao(ficha, cfg), o);
        }
        return 0;
      }

      default:
        console.error(`Comando desconhecido: "${comando}".\n`);
        console.error(AJUDA);
        return 2;
    }
  } catch (e) {
    const msg = (e as Error).message;
    if (o.texto) console.error(`Erro: ${msg}`);
    else console.log(JSON.stringify({ erro: msg }, null, 2));
    return 1;
  }
}

// executa quando chamado direto, não quando importado por um teste
const chamadoDireto =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  /cli\.(ts|js)$/.test(process.argv[1]);
if (chamadoDireto) process.exit(executar(process.argv.slice(2)));
