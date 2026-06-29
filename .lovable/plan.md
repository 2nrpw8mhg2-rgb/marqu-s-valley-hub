## Plano

1. **Tratar Demolições como regra especial obrigatória**
   - Detetar artigos da família Demolições/Estrutura como já acontece hoje.
   - Para estes artigos, aplicar um filtro mais restritivo antes de qualquer termo negativo ser guardado.

2. **Bloquear materiais, produtos, sistemas e componentes mesmo dentro de frases**
   - A lista atual só bloqueia quando o termo completo é exatamente igual a um material, por isso deixa passar frases como `argamassa de cimento e areia`.
   - Vou adicionar uma validação por tokens/expressões para rejeitar negativos que contenham materiais, produtos, elementos ou sistemas construtivos: `argamassa`, `cimento`, `areia`, `junta`, `tijolo`, `cerâmico`, `fibra`, `polipropileno`, `betonilha`, `alvenaria`, `reboco`, `isolamento`, `betão`, etc.

3. **Extrair só a operação incompatível**
   - Quando um candidato de Demolições contiver uma ação de construção nova, guardar apenas a ação normalizada:
     - `fornecimento e assentamento de alvenaria` → `fornecimento e assentamento`
     - `fornecimento e aplicação de betonilha` → `fornecimento e aplicação`
     - `execução de reboco` → `execução`
     - `montagem de ...` → `montagem`
   - A frase completa com o material deixa de ser persistida.

4. **Permitir negativos em Demolições apenas se forem operações novas**
   - Para Demolições, um negativo só passa se corresponder a uma ação incompatível clara: `fornecimento e aplicação`, `fornecimento e assentamento`, `execução`, `construção`, `assentamento`, `montagem`, `instalação`, `aplicação`, `colocação`, `fabrico`, `betonagem`, `regularização`, `acabamento`, `pintura`, `impermeabilização`.
   - Se não houver uma ação deste tipo, o termo é rejeitado como neutro, mesmo que tenha suporte estatístico noutra especialidade.

5. **Aplicar o mesmo saneamento na limpeza retroativa**
   - Além de impedir novos erros, a limpeza inicial da run vai apagar negativos antigos de Demolições que sejam materiais/sistemas/frases completas inválidas.
   - Também vai substituir, quando possível, expressões antigas por ações limpas apenas se respeitarem as regras e não duplicarem termos existentes.

6. **Manter a geração por IA fora dos negativos**
   - A IA continuará proibida de gerar `termos_negativos` diretamente.
   - A correção será feita no algoritmo determinístico que deriva e valida os negativos antes de gravar.

## Ficheiro a alterar

- `src/lib/biblioteca-mestra/knowledge-builder.server.ts`

## Validação esperada

Depois de executar novamente **Regenerar tudo (apenas IA)** em Demolições Gerais:

- Não devem aparecer negativos como `argamassa de cimento e areia`, `junta horizontal e vertical`, `cimento aluminoso`, `tijolo cerâmico`, `fibra de polipropileno`, `betonilha`, `alvenaria`.
- Expressões como `fornecimento e assentamento de alvenaria` devem passar apenas como `fornecimento e assentamento`.
- Expressões como `fornecimento e aplicação de betonilha` devem passar apenas como `fornecimento e aplicação`.
- Se não houver operação incompatível segura, o sistema deve registar que não encontrou negativos com confiança suficiente.