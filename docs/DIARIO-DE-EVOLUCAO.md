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
