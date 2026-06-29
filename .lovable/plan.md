## Problema

A geração de termos negativos está a inserir termos errados ou irrelevantes nos Artigos Mestre, prejudicando o score da classificação. O sistema atual tenta sempre devolver até 12 negativos por artigo, mesmo quando a evidência estatística é fraca, e não cruza os candidatos com os termos efectivamente usados nas classificações reais desse Artigo Mestre.

## Objectivo

Tornar a geração de negativos conservadora e explicável: **zero negativos é um resultado válido**. Só gravar automaticamente quando houver confiança elevada; oferecer confiança média como sugestão para validação; descartar tudo o resto.

## Alterações (apenas em `src/lib/biblioteca-mestra/knowledge-builder.server.ts`)

### 1. Lista de bloqueio estrutural por família

Criar `BLOQUEIO_ESTRUTURAL` por família de especialidade (mapa `familia → Set<string>` em forma canónica). Para **Demolições / Estrutura / Betão Armado** bloquear:
`betão, laje, viga, pilar, sapata, muro, estrutura, estrutural, metálica, perfil, ferro, aço, corte, desmontagem, demolição` (mais singulares/plurais via `lemaSingular`).

A família é inferida pelo `codigo`/`nome` da especialidade do artigo. Termos nessa lista nunca podem virar negativos para artigos dessa família.

### 2. Cruzar candidatos com o histórico real do próprio Artigo Mestre

Antes de chamar `derivarNegativos`, construir `vocReaisDoArtigo: Set<string>` a partir de `fontes.historico` (todas as descrições de `classificacao_artigos` validadas/auto deste artigo mestre) — tokenizar + `lemaSingular` + canonicalizar. Passar este conjunto a `derivarNegativos` e rejeitar qualquer candidato cujo termo apareça nele (regra 4: "se aparece frequentemente nos artigos reais classificados nesse Artigo Mestre, remover").

### 3. Endurecer `derivarNegativos`

Substituir o gate actual por critérios mais exigentes e explicáveis:

- Mantém: `tokenGenerico`, `vocPositivoCanonico`, `presencaThis ≤ 1%`, `thisCount ≤ 1`.
- **Novo**: rejeita se o termo estiver em `BLOQUEIO_ESTRUTURAL` da família do artigo.
- **Novo**: rejeita se estiver em `vocReaisDoArtigo`.
- **Mais estrito**:
  - `bestSize ≥ 6` (era 4) — suporte absoluto na especialidade dominante
  - `bestDom ≥ 0.65` (era 0.50) — dominância
  - `exclusividade ≥ 0.80` (era 0.70)
  - `totalAll ≥ 8` (era 5)
  - `idx.totalPorEsp(bestEsp) ≥ 6` (era 3)

### 4. Confiança em três níveis

Calcular `score = exclusividade * bestDom` e mapear:

- `score ≥ 0.70` → **alta** → gravar com `origem='ia'`, `confianca = 80..95`.
- `0.55 ≤ score < 0.70` → **média** → gravar com `origem='sugestao_ia'` e `confianca = 55..75` (não conta como aprovado para o motor — ver ponto 6).
- `score < 0.55` → **baixa** → descartar.

`maxResultados` desce de 12 para **6** (alta) + **6** (média), no máximo.

### 5. Justificação obrigatória e mais informativa

Cada negativo grava `justificacao` no formato:

> `"tomada" é específico de Instalações Elétricas (12 de 14 ocorrências; 86% exclusividade, 71% dominância) e nunca aparece no histórico real deste artigo.`

### 6. Origem "sugestão" para confiança média

Estender o tipo `origem` aceite na inserção para incluir `'sugestao_ia'` quando o nível for médio. O motor de classificação **ignora** negativos com `origem='sugestao_ia'`; o utilizador valida-os no separador Conhecimento (passa a `origem='utilizador'` ao aprovar — fluxo já existente em `aprovarConhecimentoRun`, que só precisa de tratar este novo valor).

> Nota: se introduzir `'sugestao_ia'` exigir alteração de schema, fica como **opção B**: marcar essa origem como `'ia'` mas com `peso=0` e flag `confianca<70`; o motor já filtra `peso<=0`. A decidir conforme constraint da coluna `origem`.

### 7. Resultado vazio é válido

Remover qualquer fallback que force devolver pelo menos N negativos. Se nada passar nos gates, `gen.termos_negativos = []` e o log mostra:

> `negativos: não foram encontrados termos com confiança suficiente`

### 8. Limpeza retroactiva no início de cada run

Reaproveitar o bloco de limpeza já existente em `processRun` para também apagar negativos previamente gravados que agora violam as regras: pertencem ao `BLOQUEIO_ESTRUTURAL` da família, ou cuja forma canónica está em `vocReaisDoArtigo` do respectivo artigo. Logar contagem.

### 9. `resolverConflitos` (já existe)

Continua a remover negativos que colidam com palavras-chave/sinónimos/expressões/materiais do mesmo artigo (regra 4 primeira alínea). Sem alterações.

## Fora do âmbito

- UI do Knowledge Builder, motor de classificação, schema de tabelas (excepto o ponto 6 opção A se a coluna `origem` permitir um novo valor — verificar antes de implementar).
- Geração de positivos (palavras-chave, sinónimos, expressões, materiais).

## Como validar após deploy

1. Em **Biblioteca Mestra → Construtor de Conhecimento**, escolher *Demolições Estruturais*.
2. Correr **"Regenerar tudo (apenas IA)"**.
3. Verificar 3 artigos mestre: nenhum deve ter `betão`, `laje`, `viga`, `pilar`, `demolição` como negativo; muitos artigos terão **0 negativos** e isso é o comportamento esperado.
4. Repetir para *Instalações Elétricas* — negativos válidos como `tubagem hidráulica`, `caixilharia` devem manter-se com justificação completa.
