# Design system — regras obrigatórias

## Botões nunca são redondos (pill)

A identidade visual da Popularia é editorial/retilínea (papel, tinta, vermelho — ver `src/constants/theme.ts`).
**Nenhum botão com rótulo de texto usa `Radius.pill`.** Isso inclui botões primários, secundários,
chips de filtro, tags de seleção e qualquer CTA. Use `Radius.sm` (ou nenhum radius, como em
`EditorialAction`) para todo botão com texto.

**Exceção — botão só com ícone:** um botão sem rótulo de texto (ex.: `IconButton`, um "X" de fechar
flutuando sobre uma foto, o avatar) pode continuar circular. Ícone-only circular é a única forma de
botão redondo aceita no app.

Antes de criar ou revisar qualquer botão:
- Tem texto? → nunca `Radius.pill`. Use `Radius.sm`.
- É só ícone, sem texto? → pode ser circular, igual ao `IconButton`.
- Avatares, fotos de perfil e elementos decorativos circulares (ex.: "planetas" da Biblioteca) não são
  botões e continuam circulares normalmente.

Se tiver dúvida se algo é "botão com texto" ou "ícone decorativo", trate como botão e use `Radius.sm`.

## Antes de adicionar um botão novo

Reutilize `PillButton`, `JoinButton`, `EditorialAction` ou `IconButton` existentes antes de criar um
estilo de botão do zero. Esses componentes já seguem a regra acima — um botão novo escrito do zero é
o jeito mais fácil de reintroduzir um botão redondo por engano.
