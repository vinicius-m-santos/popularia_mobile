/**
 * Configuração de ambiente do app.
 *
 * Variáveis `EXPO_PUBLIC_*` são embutidas no bundle e ficam visíveis para
 * qualquer pessoa que inspecione o app. Nunca coloque segredos aqui: tokens e
 * credenciais devem ficar no backend (API Symfony/API Platform).
 */

/** URL base da futura API. Vazia nesta etapa: o app usa apenas dados mockados. */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

/** Enquanto não houver API, todas as features leem de `src/mocks`. */
export const USE_MOCKS = API_BASE_URL === '';

/** Latência simulada dos mocks, para exercitar estados de carregamento. */
export const MOCK_LATENCY_MS = 400;
