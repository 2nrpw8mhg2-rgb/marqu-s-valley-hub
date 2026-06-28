## Barra de progresso em tempo real durante a classificação

Atualmente, durante o run aparece apenas uma barra fina com "X de Y". Vamos enriquecer para mostrar contadores ao vivo, no formato pedido.

### Layout durante o run

```text
A classificar artigos…                                  62%

387 artigos
██████████████░░░░░░░░░░

192 classificados        61 a rever        134 por analisar
```

- **387 artigos** — total do orçamento
- **192 classificados** — itens já processados com match (exato + aprendido + score alto)
- **61 a rever** — itens processados com confiança parcial / sem classificação segura
- **134 por analisar** — ainda não processados (total − done)

Mapeamento dos rótulos do exemplo do utilizador:
- "classificados" = `auto_exato + auto_aprendido` (corresponde a "verde/azul")
- "pendentes" = `parcial + sem_classificacao` já processados (precisam atenção humana)
- "por analisar" = restantes ainda não passados pelo motor

### Mudanças

**1. `src/lib/classificacao/engine.ts` — `runClassificacao`**

- Substituir o callback `onProgress(done, total)` por `onProgress(snapshot)` com:
  ```ts
  { total, done, classificados, pendentes, porAnalisar }
  ```
- Acumular os contadores durante o loop (não só no fim) e emitir o snapshot a cada item (ou cada 10) para feedback fluido. Total continua igual a `lista.length` para o cálculo de progresso, com o `total` exposto a ser `artigos.length` (inclui validados já contados como classificados desde o início).

**2. `src/routes/_app/motor-classificacao.tsx`**

- Estado `progress` passa a guardar o snapshot completo.
- Bloco "Em curso" passa a renderizar:
  - cabeçalho com percentagem;
  - linha "N artigos";
  - barra de progresso maior (`h-3`, com `transition-all`);
  - três contadores em grid (classificados / a rever / por analisar) com cores semânticas (verde / amarelo / muted), usando os tokens do design system.
- Pequenos detalhes: número formatado com `toLocaleString('pt-PT')`, animação `animate-pulse` no contador "por analisar" para reforçar o "em tempo real".

**3. Nada mais muda** — sem alterações de BD, sem mexer no fluxo "Iniciar Classificação" nem nos resultados finais.

### Notas

- A barra fica visível enquanto `running === true`. Quando o run termina, a UI já transita para o painel de resultados (sem alteração).
- Mantém-se o comportamento atual de só correr quando o utilizador clica "Iniciar Classificação".
