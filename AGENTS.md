# Guia para agentes

Este documento é para **agentes de IA e programas** que precisam operar o Class
System. O `README.md` explica o jogo; este arquivo explica como mexer nele sem
ler 10.000 linhas de TypeScript.

Leia isto **antes** de abrir qualquer arquivo de `src/`.

---

## 1. Comece pela CLI, não pelo código

Quase toda pergunta sobre o sistema já tem uma consulta pronta. Ela devolve
JSON determinístico e é muito mais barata que ler o registro.

```bash
npm run cs -- panorama                       # o tamanho do sistema
npm run cs -- buscar "vulcao"                # acha qualquer coisa por nome
npm run cs -- explicar lava                  # ficha técnica de um elemento
npm run cs -- listar arquetipos --limite 10
npm run cs -- integridade                    # consistência do conteúdo
```

Com uma ficha (JSON no formato que o simulador exporta):

```bash
npm run cs -- analisar --ficha ficha.json
npm run cs -- proximas --ficha ficha.json --limite 5        # o que está a um passo
npm run cs -- arquetipos-proximos --ficha ficha.json
npm run cs -- caminho vulcanologo --ficha ficha.json        # plano de pontos
npm run cs -- skill --ficha ficha.json --skill skill.json
npm run cs -- modificadores --ficha ficha.json --skill skill.json
npm run cs -- fusao --ficha ficha.json --skills a.json,b.json
```

`--texto` troca JSON por saída legível. `npm run cs -- ajuda` lista tudo.

Em TypeScript, o mesmo está em `src/api/consultas.ts` — importe de lá, não de
`engine/` diretamente, a menos que precise de algo que a API não expõe.

---

## 2. O modelo mental, em sete frases

1. O jogador distribui **pontos diretos** em 17 **elementos base**, 6 **escolas**,
   5 **recursos**, **talentos** e **profissões**. Nada mais é escolhido.
2. Tudo o resto **emerge** desses pontos: elementos derivados, arquétipos,
   capacidades, propriedades de item.
3. Um **elemento derivado** existe quando todos os componentes da sua receita
   atingem o nível mínimo; o nível dele é o **menor** entre os componentes.
4. Há **3.215 elementos alcançáveis**: 17 base, 136 pares, 680 triplas, 2.380
   quádruplas. Os pares são nomeados à mão; triplas e quádruplas são 64 curadas
   e ~3.000 **geradas sob demanda**.
5. Uma **skill** é elemento + escola + fontes de energia + forma (energia,
   tempo, alcance, área, entrega). O motor calcula custo e impacto.
6. **Modificadores** (2ª geração) alteram uma skill; **fusão** combina 2 a 4
   skills numa de 2ª/3ª geração, e o elemento resultante é a **combinação dos
   elementos dos componentes**.
7. **Arquétipos** nunca são escolhidos — eles se desbloqueiam sozinhos quando a
   distribuição de pontos satisfaz a condição.

---

## 3. Os invariantes que você não pode quebrar

Se uma mudança sua viola um destes, ela está errada, mesmo que os testes passem.

| Invariante | Onde vive | Como verificar |
|---|---|---|
| `impacto ÷ energia` fica estável entre builds (tolerância <1.35×) | `engine/skills.ts` | `tests/skills.test.ts` |
| Combinar fica dentro de ~25% de especializar, com o mesmo orçamento | `FRACAO_BONUS_ARIDADE` | `tests/combinacoes-narias.test.ts` |
| Fundir nunca supera 1.10× a eficiência de lançar separado | `TETO_EFICIENCIA_FUSAO` | `tests/fusao.test.ts` |
| Produto dos modificadores nunca passa de ×2.2 | `TETO_MULT_MODIFICADORES` | `tests/fusao.test.ts` |
| Os 3.060 nomes de combinação são únicos | `registry/combinacoes.ts` | `tests/combinacoes-narias.test.ts` |
| Cada combinação tem posição estável e única no céu | `ui/ceu-layout.ts` | `tests/ceu-layout.test.ts` |
| Todo id referenciado existe e todo arquétipo é alcançável | registros | `npm run cs -- integridade` |

**O motor é puro e determinístico.** Sem `Date.now()`, sem `Math.random()` fora
de PRNG semeado, sem I/O. Mesma ficha → mesmo resultado, sempre.

---

## 4. Onde as coisas moram

```
src/registry/   DADOS. Conteúdo do jogo. Sem lógica de cálculo.
src/engine/     MOTOR. Cálculo puro sobre os dados. Sem DOM, sem I/O.
src/api/        CONSULTAS. A superfície para máquinas (você está aqui).
src/ui/         APRESENTAÇÃO. Só consome o engine; nunca reimplementa regra.
```

**Adicionar conteúdo nunca deve exigir tocar no motor.** Se sua mudança pede um
`if` novo no engine para cada entrada nova de conteúdo, o desenho está errado —
proponha um campo declarativo no registro.

Arquivos por assunto:

| Quero mexer em | Arquivo |
|---|---|
| Elementos base, pares, sinergias | `registry/elementos.ts` |
| Triplas e quádruplas | `registry/combinacoes.ts` (`CURADAS`) |
| Modificadores de skill | `registry/modificadores.ts` |
| Talentos | `registry/talentos.ts` |
| Arquétipos | `registry/arquetipos.ts` |
| Profissões, itens, propriedades | `registry/profissoes.ts` |
| Criaturas | `registry/criaturas.ts` |
| Afinidade elemental | `registry/afinidades.ts` |
| Estados/condições | `registry/estados.ts` |
| Cálculo de skill e constantes de balanceamento | `engine/skills.ts` |
| Fusão | `engine/fusao.ts` |
| Progressão, transbordo, arquétipos | `engine/progressao.ts` |
| Posição das estrelas no céu | `ui/ceu-layout.ts` |

---

## 5. Formatos

### Ficha (`Personagem`)

Objeto JSON simples. Todos os campos são opcionais exceto `nome`.

```json
{
  "nome": "Vulcanólogo",
  "elementos": { "fogo": 17, "terra": 17, "ar": 17 },
  "escolas": { "conjuracao": 12 },
  "recursos": { "mana": 10 },
  "talentos": { "sintonia_de_receita": 2 },
  "bestiario": [{ "criaturaId": "salamandra", "nivelVinculo": 2 }],
  "profissoes": { "ferreiro": 8 }
}
```

**Inválido:** `"elementos": { "lava": 12 }` — derivados **não aceitam pontos
diretos**. Investir em `fogo` e `terra` é o que produz `lava`.
**Inválido:** `"elementos": { "fogo": 2.5 }` — pontos são inteiros positivos.

### Skill (`SkillConfig`)

```json
{
  "nome": "Erupção",
  "elemento": "lava",
  "escola": "conjuracao",
  "fontes": [{ "recurso": "mana", "proporcao": 100 }],
  "energia": 28,
  "tempoConjuracaoSegundos": 2.5,
  "alcanceMetros": 10,
  "area": { "tipo": "circulo", "raioMetros": 6 },
  "entrega": { "tipo": "instantaneo" },
  "modificadores": ["sobrecarga_bruta"]
}
```

`fontes` aceita várias entradas com proporções livres — elas são normalizadas,
então `[{mana:60},{furia:40}]` e `[{mana:6},{furia:4}]` são a mesma coisa.
`area` é `{"tipo":"unico"}` ou `{"tipo":"circulo","raioMetros":N}`.
`entrega` é `{"tipo":"instantaneo"}` ou `{"tipo":"continuo","duracaoSegundos":N}`.

**Inválido:** elemento sem nível efetivo na ficha; escola sem pontos; fonte de
energia sem proficiência; energia acima do teto; mais modificadores que slots.
Todos esses casos vêm com mensagem explicando **o que destrava**.

### Fusão (`FusaoConfig`)

```json
{
  "nome": "Erupção Sombria",
  "componentes": [ { "...SkillConfig" }, { "...SkillConfig" } ],
  "modificadores": []
}
```

2 componentes → 2ª geração. 3 ou 4 → 3ª geração. O elemento resultante é a
combinação dos elementos base dos componentes, **se a ficha já a desbloqueou**;
senão a fusão acontece com o elemento do componente mais forte e devolve um
aviso em `avisos`.

---

## 6. Erros que agentes cometem neste sistema

1. **Investir pontos num elemento derivado.** `investirElemento(p, 'lava', 12)`
   lança erro. Derivados emergem; só os 17 base aceitam pontos.
2. **Esquecer que o nível efetivo ≠ pontos diretos.** As sinergias de transbordo
   fazem investir em `vida` elevar `fogo`, `agua`, `terra`, `ar` e
   `eletricidade`. Use `calcularProgressao` ou `analisarFicha`, nunca leia
   `p.elementos` como se fosse o nível final.
3. **Assumir que combinações têm ids "bonitos".** Curadas têm (`vulcao`,
   `supernova`); procedurais têm `comb_fogo_terra_sombra`. Use
   `elementoDePorComponentes([...])` ou `buscar` em vez de adivinhar o id.
4. **Ler `ELEMENTOS[id]` para uma combinação procedural.** Ela não está lá — o
   registro só tem base, pares e as curadas antigas. Use `elementoDef(id)` de
   `registry/combinacoes.ts`, que resolve tudo.
5. **Comparar com `undefined`.** `prog.niveisEfetivos[x] <= 0` é `false` quando
   a chave não existe. Sempre `(prog.niveisEfetivos[x] ?? 0)`.
6. **Calcular balanceamento por conta própria.** Se você precisa de um número
   de poder, chame `calcularSkill`. Reimplementar a fórmula garante divergência.
7. **Adicionar conteúdo e não rodar `integridade`.** Um arquétipo que exige um
   elemento inexistente passa despercebido para sempre — a verificação leva
   milissegundos.

---

## 7. Antes de entregar

```bash
npm test              # a suíte inteira
npx tsc --noEmit      # tipos
npm run cs -- integridade   # consistência do conteúdo
npm run build:sim     # regenera simulador.html se você mexeu em src/ui/
```

Se você mexeu numa constante de balanceamento, **meça antes e depois** — o
agente `experimentador` (`.claude/agents/experimentador.md`) existe para isso, e
o `supervisor-de-balanceamento` para caçar o que a medição não pegou.

Escreva em **português do Brasil**: nomes, comentários e mensagens de erro. Neste
repositório mensagem de erro é interface, não log — ela precisa dizer o que
fazer, não só o que falhou.
