# Changelog

## 2026-11-03

### Publicações

- A autoria pode **editar** texto e título em `PATCH /posts/{id}`.
- A autoria pode **excluir** a publicação em `DELETE /posts/{id}`; a operação continua sendo soft delete no servidor.
- A tela `editar-publicacao/[id]` abre pelo menu “⋯” de uma publicação própria.
- Ações de auditoria passaram a usar `App\Enum\AdminAuditAction`:
  - `UPDATE_POST_ACTION`
  - `DELETE_POST_ACTION`
  - `UPDATE_EVENT_DATA_ACTION`
- O log grava o ID do conteúdo e os campos alterados.

### Chamados

- Chamados podem ser publicados no próprio perfil (evento sem comuna) e em até 3 comunas.
- O composer mostra os campos pendentes: título, data/hora e local.
- O título do chamado é salvo em caixa alta.
- O contador de pessoas acelera progressivamente e chega a +1000 em cerca de 5 segundos.

### Correções

- Pessoas bloqueadas voltaram a carregar em `GET /me/blocks`; o recurso ganhou rota de item.
- Biblioteca pessoal e da comuna receberam altura flexível no conteúdo.
- Perfil: avatar centralizado, botão de mensagem removido e troca de aba volta ao início do conteúdo.
- Busca do Explorar alinhada à borda de 2 dos demais campos de busca.
- Comentários: composer com cantos retos, borda 2 e botão quadrado; menu com compartilhar, denunciar e excluir.
