# Diário de evolução — 20 loops

Registro do que foi feito, na ordem em que foi feito, e por quê. Cada loop é
uma unidade de trabalho fechada: ou entregou código, ou entregou uma decisão
de design que mudou o código seguinte.

---

## Loop 1 — Os seis agentes

Criados em `.claude/agents/`, como definições persistentes do repositório —
não como instâncias descartáveis de uma sessão.

| Agente | O que protege / produz |
|---|---|
| `arquiteto-de-sistema` | A separação registry/engine/ui e o invariante de balanceamento |
| `combinador` | Nomes e identidade mecânica de combinações; léxicos de nomenclatura |
| `experimentador` | Evidência numérica: varreduras, curvas, outliers nomeados |
| `supervisor-de-balanceamento` | Build degenerada, combinação morta, requisito impossível |
| `pesquisador-benchmark` | Padrões consagrados de outros jogos, com modo de falha documentado |
| `curador-de-constelacao` | O céu legível enquanto o conteúdo cresce de centenas para milhares |

## Loop 2 — Pesquisa e desenho em paralelo

Pesquisador e Curador postos a trabalhar simultaneamente enquanto o motor era
construído. Os dois voltaram com material que **mudou o design** — ver loops 8
e 15.

## Loops 3–5 — O motor de combinações N-árias

`src/registry/combinacoes.ts`. O espaço completo: **680 triplas + 2.380
quádruplas = 3.060 combinações**, enumeradas eagerly como metadados leves e
materializadas (nome, descrição, perfil) **sob demanda, com cache**.

Decisões:

- **Curadoria híbrida.** 64 combinações com identidade forte ganham nome à mão;
  as outras ~3.000 são procedurais. Nada é inalcançável.
- **Nomenclatura composicional.** Tripla = `{Par(a,b)} {adjetivo(c)}`;
  quádrupla = `{Par(a,b)} d{o|a} {Par(c,d)}`. Como os 136 pares já são únicos
  e a ordenação é determinística, os nomes são **provadamente únicos** —
  verificado sobre os 3.060, zero colisões.
- **Concordância de gênero.** Heurística de português sobre a palavra-cabeça,
  com exceções (`Miasma` masculino, `Fênix` feminino, `-ção`/`-são` femininos
  mas `Trovão` masculino).
- **Coerência** por par de componentes, lida das sinergias (aliados) e da
  tabela de afinidade (opostos): harmônica / neutra / em tensão / paradoxal.
  Tensão sobe o fator de potência e o nível mínimo; harmonia baixa os dois.

## Loop 6 — Compensação de aridade

O problema, medido: um derivado de N componentes no nível L custa N×L pontos e
rendia como um elemento no nível L. Especializar dominava qualquer combinação,
e triplas/quádruplas eram conteúdo decorativo.

```
bônus por nível = 0.04 × (1 + 0.30 × (N − 1))
```

Compensação **parcial** de propósito — combinar já paga em largura.

## Loop 7 — Primeira verificação empírica

3.060 combinações, 3.060 nomes distintos, zero colisões. Distribuição de
coerência: 85 harmônicas, 1.701 neutras, 1.000 em tensão, 274 paradoxais.

## Loops 8–9 — Modificadores de skill (2ª geração)

O Pesquisador voltou com o diagnóstico: **o sistema não tinha nenhuma camada
de skill-modifica-skill**. Talentos eram globais e passivos.

`src/registry/modificadores.ts` — 23 modificadores no contrato canônico:

1. **Custo multiplicativo** (×1.45 × ×1.28 = ×1.86, não ×1.73).
2. **Compatibilidade por tag** — a maioria das células da matriz não existe.
3. **Nenhum é ganho puro** — Sobrecarga Bruta rende eficiência 0.92.
4. **Slots, não escassez global.**

Teto duro de ×2.2 no produto de multiplicadores, com aviso no resultado.

## Loops 10–11 — Fusão de skills (2ª e 3ª geração)

`src/engine/fusao.ts`. A decisão que amarra tudo: **fundir skills funde os
elementos delas.** Fogo + Terra → Lava. Três → a tripla. Quatro → a quádrupla.
A árvore de combinações vira a gramática das fusões.

A fusão **não tem fórmula própria**: monta uma `SkillConfig` sintética e chama
`calcularSkill`, herdando o invariante inteiro. Sem risco de as duas fórmulas
divergirem com o tempo.

Modos emergentes (não escolhidos): Sequência, Amálgama, Ressonância, Catálise,
Prisma.

## Loop 12 — 19 talentos novos

Cinco trilhas: fusão, combinação, ofício, híbridos entre escolas, e os dois
que mexem na própria estrutura de progressão — `receita_minimo_reducao` e
`nivel_derivado_bonus`, tipos de efeito novos lidos por `calcularProgressao`.

*Sintonia de Receita* (−2 níveis/rank no mínimo de toda receita) é o caminho
prático para as quádruplas.

## Loop 13 — Cinco ofícios novos

Encantador, Escriba, Cozinheiro, Luthier, Cartógrafo. 20 itens-base e 14
propriedades emergentes — seis delas exigindo combinações de aridade alta.

## Loop 14 — Arquétipos e meias-identidades

26 arquétipos novos ligados às combinações curadas.

E a correção do modo de falha mais importante do dossiê de benchmark: se
combinar mais só desse um multiplicador maior, o jogador ótimo sempre subiria
a escada e as combinações menores virariam conteúdo de passagem. A resposta:
toda combinação de 3+ componentes concede versões **diluídas** (−18%) das
capacidades dos arquétipos contidos na sua receita. **Aridade compra largura
de identidade, não altura.**

## Loops 15–16 — O novo Céu dos Elementos

`src/ui/ceu-layout.ts`, matemática pura e testável, sem DOM.

O Curador voltou com a constatação que definiu o desenho: **desenhar 3.215 nós
é geometricamente impossível em qualquer escala**. A resposta não é reservar
slot para tudo — é dar a cada combinação um **endereço absoluto e permanente**
e deixar a política de visibilidade decidir o que vira DOM.

Endereço canônico `(âncora, arco, padrão)`, derivado só dos índices dos
componentes. Verificado **injetivo**: 136/136 pares, 680/680 triplas,
2380/2380 quádruplas, zero colisões, nada fora do quadro.

Para pares, a fórmula nova é uma **generalização estrita da antiga** — a
mandala existente não se moveu um pixel.

## Loop 17 — Integração da constelação

Política de visibilidade por score de prioridade, teto de 480 nós no DOM,
controles de profundidade (2/3/4), lente, zoom por faixa, busca sobre as
3.215 combinações e foco de linhagem (ancestrais e descendentes por
continência de receita). CSS com quatro eixos ortogonais de classe.

## Loop 18 — O achado que valeu o esforço

Medindo a fusão: a 3ª geração entregava **1.90× o impacto somado dos
componentes por 1.46× do custo** — eficiência 1.30×. Fundir era estritamente
melhor que lançar separado, ou seja, **obrigatório**.

A causa: o teto era absoluto (sobre o impacto), e concentrar energia numa skill
só já é naturalmente superlinear neste motor (√tempo, nível do elemento
combinado, fator de potência maior). Um teto absoluto precisaria de
recalibração a cada aridade.

Correção: **teto de eficiência relativa** (1.10×), que escreve a intenção de
design direto na regra e se auto-ajusta para qualquer número de componentes.

| | ganho | custo | eficiência |
|---|---|---|---|
| 2ª geração | 1.39× | 1.36× | 1.03× |
| 3ª geração | 1.60× | 1.46× | 1.10× (no teto) |

## Loop 19 — Testes

Três arquivos novos, **50 testes** (162 no total, todos passando):

- `combinacoes-narias.test.ts` — enumeração, unicidade de nome sobre os 3.060,
  gênero, coerência, progressão, compensação de aridade, meias-identidades.
- `fusao.test.ts` — elemento resultante por aridade, modos emergentes, o teto
  de eficiência, custo multiplicativo dos modificadores, slots.
- `ceu-layout.test.ts` — injetividade do endereço, 3.196 posições distintas,
  faixas que não se invadem, estabilidade.

Dois bugs reais encontrados pelos próprios testes e corrigidos na fonte:
`elementoDePorComponentes` não resolvia pares, e a fusão de aridade 2 não
reconhecia a combinação como desbloqueada.

## Loop 20 — Fechamento

`npm run build:sim` regenerado (554 KiB), README com as Camadas 10, 11 e 12,
e este diário.

---

## Números finais

| | antes | depois |
|---|---|---|
| Elementos alcançáveis | 169 | **3.215** |
| Combinações de 3 componentes | 13 | **680** (64 curadas no total) |
| Combinações de 4 componentes | 1 | **2.380** |
| Talentos | 46 | **65** |
| Profissões | 6 | **11** |
| Propriedades de item | 16 | **30** |
| Itens-base | 27 | **47** |
| Arquétipos | 53 | **79** |
| Modificadores de skill | 0 | **23** |
| Modos de fusão | 0 | **5** |
| Testes | 112 | **162** |

---

# Segunda rodada — 40 loops

## Loops 1–6 — O time completo e o briefing paralelo

Sete agentes novos em `.claude/agents/`: `orquestrador`, `arquiteto-de-api-para-ia`,
`designer-de-experiencia`, `pesquisa-de-usuario`, `qa-e-testes`,
`revisor-de-codigo`, `redator-tecnico` — somando treze com os seis da primeira
rodada.

Quatro rodaram em paralelo enquanto o motor era construído: personas
percorrendo o sistema, desenho da superfície para IA, UX do simulador e uma
segunda rodada de benchmark. **Os quatro voltaram com bugs medidos, não com
opinião** — e foi isso que definiu os loops 25 em diante.

## Loops 7–14 — A camada para IA

`src/api/consultas.ts` responde as perguntas que um agente de fato faz: o que
esta ficha alcançou, o que está a um passo e por quanto, qual o caminho até um
arquétipo, por que esta skill é inválida. Determinismo, orçamento de contexto e
erro que ensina, nos três casos.

`caminhoParaArquetipo` é **verificado ponta a ponta**: monta a ficha resultante,
roda a progressão e confirma o destrave. `pontosDiretosPara` faz descida gulosa
aproveitando o transbordo das sinergias e cai na solução ingênua se a descida
não atender — nunca devolve um plano que não funciona.

`verificarIntegridade()` varre o conteúdo procurando id órfão, requisito
impossível e arquétipo inalcançável. `src/api/cli.ts` expõe tudo via `npm run cs`.
`AGENTS.md` é o que um modelo lê antes de mexer: modelo mental em sete frases,
tabela de invariantes, formatos com exemplos válidos **e inválidos**, e os sete
erros que agentes cometem aqui.

## Loops 15–24 — A interface das camadas 10 e 11

O relatório de design apontou que os 23 modificadores e a fusão inteira **não
tinham controle nenhum na tela**: os dados estavam no bundle e nada os
alcançava.

- **Modificadores** entraram dentro da aba Criar Skill, não numa aba própria —
  um modificador fora de uma skill não tem compatibilidade nem custo. Agrupados
  por família, com a linha "esta skill é: [tags]" que ensina a matriz de
  compatibilidade, os incompatíveis colapsados **com o motivo**, a barra do teto
  sempre visível e a cascata de custo que mostra 1.45 × 1.28 = **1.86, não 1.73**.
- **Fusão** virou aba própria, consumindo skills salvas. A linha de convergência
  mostra os sigilos dos componentes, a seta e o elemento que nasce — antes de
  confirmar. A comparação contra lançar separado é duas barras e um veredito de
  duas palavras, não um parágrafo.
- **O céu deixou de ter default fixo.** Com ficha zerada e profundidade 3, quase
  todo derivado caía em `e-distante` sem rótulo: a tela mais cara do simulador
  abria mostrando 17 pontos nomeados e centenas de manchas anônimas. Agora o
  default deriva da ficha e desliga assim que o usuário toca num controle.
- Bug corrigido: a lista de abas válidas em `carregar()` era um array literal
  que esquecia `bestiario` e `profissao` — as duas perdiam contexto no reload.

## Loops 25–28 — A fusão perdia aridade em silêncio

Achado do benchmark, confirmado por medição:

```
Lava (fogo+terra) + Gelo (água+ar)  →  "Vapor"   ← o par fogo+água
```

`basesEnvolvidas` colapsava cada componente no seu **base dominante**. A
promessa "fundir skills funde os elementos delas" só valia quando os
componentes eram elementos base. Agora a união percorre a receita inteira de
cada componente, respeita `ARIDADE_MAXIMA` e avisa o que ficou de fora quando
passa de 4.

## Loops 29–33 — O combo degenerado

Achado da persona otimizadora, reproduzido:

```
Repetição Ecoada + Canalização Arriscada + Sangria Arcana + Contenção Disciplinada
  → 2.26× a eficiência da skill nua, e o teto NÃO disparava
```

Duas frestas no teto absoluto de ×2.2:

1. `tempo_fracao` alimenta √tempo no orçamento e ficava **fora** do produto
   grampeado — alongar a conjuração comprava poder de graça;
2. um modificador de poder **negativo** (Contenção Disciplinada) abaixava o
   produto grampeado e liberava espaço sob o teto para os positivos.

A correção é a mesma que já tinha resolvido a fusão: **teto de eficiência
relativa** (1.40×), que captura tempo, custo e poder juntos.

| | antes | depois |
|---|---|---|
| combo degenerado | 2.26× | **1.40×** (no teto) |
| Contenção Disciplinada sozinha | 1.29× | 1.29× (preservada) |
| Sobrecarga Bruta sozinha | 0.92× | 0.92× (inalterada) |

E **16 arquétipos declaravam um limiar abaixo do piso real da combinação** —
`vulcao: 14` quando Vulcão nunca existe abaixo de 17, porque o nível de um
derivado é o menor dos componentes. Quem lia a condição e investia exatamente o
pedido não desbloqueava nada. Corrigidos os 16, com teste que reprova o padrão.

## Loops 34–38 — Portas de entrada e regressões

- **23 dos 65 talentos eram invisíveis no simulador**: a árvore renderiza de uma
  lista manual que parou em 42. Agrupados os 23, e uma rede de segurança joga
  qualquer talento não agrupado num grupo "Outros" em vez de sumir.
- `src/index.ts` não exportava `combinacoes`, `modificadores`, `fusao` nem a
  API: quem importava o pacote não alcançava as Camadas 10 e 11.
- `tests/regressoes.test.ts`: um teste por bug, escrito a partir do cenário que
  o revelou.

## Loops 39–40 — Documentação e fechamento

README com os números medidos (30→65 talentos, 29→79 arquétipos, 6→11
profissões) e a seção "Para programas e agentes". Simulador regenerado.

---

## Números da segunda rodada

| | antes | depois |
|---|---|---|
| Agentes especializados | 6 | **13** |
| Consultas de API | 0 | **20** |
| Comandos de CLI | 0 | **13** |
| Testes | 162 | **201** |
| Bugs de correção encontrados e corrigidos | — | **6** |
| Talentos alcançáveis pela interface | 42 | **65** |

---

## Rodada 3 — Alocação geracional (ago/2026)

Pedido do dono: ponto direto nasce restrito aos 17 elementos base; investir nos
dois pais de um par rende pontos PASSIVOS no par (5 fogo + 5 água → 1 vapor);
um derivado com 10 passivos DESTRAVA a alocação direta; triplas e quádruplas
seguem a mesma escada com os pais de aridade N−1; gerações altas pesam mais.

Decisões de arquitetura (plano do arquiteto-de-sistema, implementado na íntegra):

- **Duas contabilidades, não uma.** `niveisEfetivos` continua medindo o que a
  ficha expressa (skills/arquétipos/evocação intocados); a CASCATA
  (`engine/cascata.ts`) mede o que virou parte da ficha — e é ela que decide
  destrave e alimento da geração seguinte. Substituir uma pela outra derrubava
  Lava de nível 12 para 2 e recalibrava o sistema inteiro.
- **Peso de geração é CUSTO, não multiplicador.** A potência por aridade já
  existia (`fatorPotencia` + compensação de aridade nas skills);
  `CUSTO_PONTO_ALOCACAO` {1,3,10,30} redistribui o orçamento em vez de
  multiplicá-lo. `pesoDiretoNaCascata = custo/custoCascataEquivalente` fecha a
  arbitragem de "destravar e despejar" por construção — 1 ponto de orçamento
  compra o MESMO progresso de cascata onde for gasto (teste de não-arbitragem).
- **Exceção no registro, não no motor**: os especiais (primordial/ciclo/nulo)
  declaram `cascata: { pais, divisor: 20, destravavel: false }` no próprio
  `ElementoDef`.
- Ponto direto em derivado só EXPRESSA com a receita atendida (impossível na
  prática — o destrave exige 5× o mínimo — mas o invariante "derivado nunca
  existe abaixo do piso" continua verdadeiro e testado).
- Constantes em `registry/geracoes.ts`; parentesco (`paisDeCascata`, DAG
  estrito por aridade) em `combinacoes.ts`; gancho de talento
  `cascata_divisor_reducao` declarado (nenhum talento usa ainda).
- UI: o detalhe do elemento derivado ganhou o ledger (passivos + diretos,
  barra de destrave, custo por ponto) e controles que só aparecem destravados.
  A UI LÊ `prog.cascata`/`prog.alocaveis` — nunca recalcula a regra.

Marcos de custo (travados em `tests/cascata.test.ts`): 1 ponto gen-2 por
cascata = 10 de orçamento · destravar gen-2 = 100 · gen-3 = 60/360 · gen-4 =
240/960 · com 1200 pontos não existem duas quádruplas destravadas disjuntas.

Testes: 204 → 225 (21 novos de cascata; 1 antigo atualizado para a regra nova).
