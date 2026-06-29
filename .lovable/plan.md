## Diagnóstico

O dialog **Editar Artigo Mestre** (categorias → editar) já tem dois separadores:

- **Geral** → campos do artigo + duas listas legadas "Palavras-chave positivas/negativas" (tabela antiga `biblioteca_artigo_keywords`, nunca alimentada pelo Knowledge Builder).
- **Conhecimento IA** → componente `ArtigoConhecimentoTab` que já mostra TUDO o que pediste: palavras-chave, sinónimos, expressões, materiais e termos negativos, com confiança, peso, ocorrências, exemplos, origem (IA / MQ / orçamentos / vizinhos / utilizador) e ações (aprovar, editar, desativar, eliminar). Lê de `biblioteca_artigo_conhecimento`, a mesma tabela que o Knowledge Builder escreve.

O problema é puramente de **descoberta**: o separador não sinaliza que tem conteúdo, e o separador "Geral" mostra listas vazias que parecem ser o sítio dos termos.

## Alterações (todas em `ArtigoMestreFormDialog.tsx`)

### 1. Badge de contagem no separador "Conhecimento IA"

Carregar a contagem de termos ativos por artigo quando o dialog abre em modo edição:

```tsx
const { data: countConhecimento = 0 } = useQuery({
  queryKey: ["bm-conhecimento-count", editing?.id],
  queryFn: async () => {
    if (!editing?.id) return 0;
    const { count } = await supabase
      .from("biblioteca_artigo_conhecimento")
      .select("id", { count: "exact", head: true })
      .eq("artigo_mestre_id", editing.id)
      .eq("ativo", true);
    return count ?? 0;
  },
  enabled: !!editing?.id,
});
```

E no separador:

```tsx
<TabsTrigger value="conhecimento" className="gap-1.5">
  Conhecimento IA
  {countConhecimento > 0 && (
    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] tabular-nums">
      {countConhecimento}
    </Badge>
  )}
</TabsTrigger>
```

### 2. Abrir no separador "Conhecimento IA" quando o artigo já tem termos

Trocar `defaultValue="geral"` por estado controlado:

```tsx
const [tab, setTab] = useState<"geral" | "conhecimento">("geral");
useEffect(() => {
  if (countConhecimento > 0) setTab("conhecimento");
  else setTab("geral");
}, [countConhecimento, editing?.id]);
<Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
```

### 3. Nota no separador "Geral"

Acima das listas legadas "Palavras-chave positivas/negativas", adicionar uma nota discreta que aponta para o separador novo, para que o utilizador não se confunda com dois sítios para a mesma coisa:

```tsx
<div className="rounded-md border border-dashed bg-muted/30 p-2 text-xs text-muted-foreground">
  As palavras-chave, sinónimos, expressões, materiais e termos negativos gerados pela IA
  estão no separador <span className="font-medium text-foreground">Conhecimento IA</span>.
  Os campos abaixo são apenas para palavras-chave manuais simples (legado).
</div>
```

(Não remover as listas legadas neste passo — podem ainda ser usadas por outros utilizadores; apenas sinalizar a hierarquia.)

## Fora do âmbito

- Não alterar `ArtigoConhecimentoTab` (já mostra tudo).
- Não tocar nas tabelas, no Knowledge Builder, nem na lógica de geração/aprovação.
- Não migrar nem eliminar `biblioteca_artigo_keywords` (decisão separada).
