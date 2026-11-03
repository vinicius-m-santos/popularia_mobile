# App Store Connect — Privacidade (respostas sugeridas)

**Data:** 01/11/2026  
**Base:** o que o app e o backend realmente tratam hoje. Revisar com jurídico antes de publicar.

## Resumo

- O app **coleta dados** (sim).
- Praticamente todos os dados de conta e conteúdo são **vinculados à identidade**.
- **Não há rastreamento** entre apps/sites, publicidade ou venda de dados.
- **Não** usamos localização precisa/GPS, câmera, microfone, contatos, saúde, finanças ou dados sensíveis.
- Sentry recebe diagnóstico com ID interno da conta; por isso “Diagnóstico” é **vinculado**.

## Tabela de categorias

| Categoria da Apple | Coletamos? | Vinculado à identidade | Rastreamento | Finalidade | Observação |
| --- | --- | --- | --- | --- | --- |
| Nome | Sim | Sim | Não | Funcionalidade do app | Nome de exibição. |
| E-mail | Sim | Sim | Não | Funcionalidade do app | Cadastro/login, verificação, suporte. |
| Número de telefone | Não | — | — | — | Não há campo de telefone. |
| Endereço físico | Não | — | — | — | Cidade declarada entra em “Localização aproximada”, não em endereço. |
| Outras informações de contato | Não | — | — | — | @ é identificador, não contato externo. |
| Saúde / condicionamento | Não | — | — | — | Sem HealthKit. |
| Dados de pagamento / crédito / finanças | Não | — | — | — | Sem compras no app. |
| Localização precisa | Não | — | — | — | Sem GPS/permissão de localização. |
| Localização aproximada | Sim | Sim | Não | Funcionalidade do app | Cidade declarada no perfil; usada para contexto e recomendações. Não é GPS. |
| Informações confidenciais | Não | — | — | — | Sem dados raciais, políticos, religiosos etc. como campo estruturado. |
| Contatos | Não | — | — | — | Sem acesso à agenda do telefone. |
| E-mails ou mensagens de texto | Não | — | — | — | Sem DM/e-mail dentro do app; comentários entram em “Outros conteúdos”. |
| Fotos ou vídeos | Sim | Sim | Não | Funcionalidade do app | upload escolhido pela pessoa para posts/avatar. |
| Dados de áudio | Não | — | — | — | Não há gravação de voz; vídeo é tratado como foto/vídeo. |
| Conteúdos de jogos | Não | — | — | — | Sem jogo. |
| Suporte ao cliente | Sim | Sim | Não | Funcionalidade do app | Mensagens enviadas em Conta → Suporte e contato. |
| Outros conteúdos de usuário | Sim | Sim | Não | Funcionalidade do app | Posts, comentários, bio, enquetes, chamados, PDFs, denúncias. |
| Histórico de navegação | Não | — | — | — | Não há navegador web embutido. |
| Histórico de buscas | Não | — | — | — | A busca é processada, mas o app não mantém histórico; se o backend passar a reter a query, mudar para “Sim”. |
| ID de usuário | Sim | Sim | Não | Funcionalidade do app | UUID da conta, @ e identificadores de sessão. |
| ID do dispositivo | Sim | Sim | Não | Funcionalidade do app | Token de push e installation ID; **não** usamos IDFA nem publicidade. |
| Histórico de compras | Não | — | — | — | Sem compras. |
| Interações com o produto | Sim | Sim | Não | Funcionalidade do app; personalização | follows, apoios, ecos, salvos, presença, abertura de posts. |
| Dados de publicidade | Não | — | — | — | Sem anúncios. |
| Outras informações de uso | Não | — | — | — | As interações relevantes entram em “Interações com o produto”. |
| Dados de falhas | Sim | Sim | Não | Funcionalidade do app | Sentry, com ID interno e IP zerado. |
| Dados de desempenho | Sim | Sim | Não | Funcionalidade do app | Sentry; tracing detalhado desabilitado, mas o SDK pode enviar dados de estabilidade. |
| Outros dados de diagnóstico | Sim | Sim | Não | Funcionalidade do app | Sentry. |
| Varredura do ambiente / mãos / cabeça | Não | — | — | — | Sem ARKit. |
| Outros dados | Sim | Sim | Não | Funcionalidade do app | IP e metadados técnicos nos logs do servidor; não usados para rastreamento. |

## Respostas de topo

- **O app coleta dados?** Sim.
- **Os dados são usados para rastrear?** Não.
- **Há publicidade de terceiros?** Não.
- **Há compras no app?** Não.
- **Os dados são vinculados à identidade?** Sim, para conta, conteúdo, localização aproximada, dispositivo, uso e diagnóstico.
- **Terceiros**: Sentry (diagnóstico), Google (login, quando escolhido), Apple (login, quando escolhido) e provedores de infraestrutura. Nenhum para rastreamento/publicidade.
- **Exclusão de conta**: disponível em Conta → Excluir conta.
- **Privacy Policy URL**: https://popularia.com.br/privacidade

## Antes de enviar

- Confirmar que o backend não passou a armazenar queries de busca. Se armazenar, marcar “Histórico de buscas” como Sim.
- Confirmar se vídeos com áudio são tratados como “Fotos ou vídeos” (recomendado) ou se o jurídico prefere marcar “Dados de áudio”.
- Confirmar a retenção de IP/logs no backend.
- Revisar a política pública depois de qualquer mudança de coleta.
