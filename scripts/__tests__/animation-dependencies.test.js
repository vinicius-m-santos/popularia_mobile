/**
 * POP-61 — Lottie só entra com PoC aprovada.
 *
 * A decisão permite adoção condicional, não adoção decorativa. Este guard
 * existe para que instalar `lottie-react-native` seja uma mudança explícita:
 * a PoC precisa atualizar `docs/pop-61-lottie-decision.md` e este teste no
 * mesmo PR, com os números de peso/custo e a revisão UX/performance.
 */
const fs = require('node:fs');
const path = require('node:path');

const PACKAGE_PATH = path.resolve(__dirname, '../../package.json');

describe('POP-61 — dependências de animação', () => {
  it('mantém Lottie fora do app enquanto não houver PoC aprovada', () => {
    const { dependencies = {}, devDependencies = {} } = JSON.parse(
      fs.readFileSync(PACKAGE_PATH, 'utf8'),
    );

    // Se esta asserção falhar, leia docs/pop-61-lottie-decision.md antes de
    // alterar a dependência: a PoC precisa estar registrada.
    expect(dependencies['lottie-react-native']).toBeUndefined();
    expect(devDependencies['lottie-react-native']).toBeUndefined();
  });
});
