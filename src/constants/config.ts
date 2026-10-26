/**
 * Configuração de ambiente do app.
 *
 * Variáveis `EXPO_PUBLIC_*` são embutidas no bundle e ficam visíveis para
 * qualquer pessoa que inspecione o app. Nunca coloque segredos aqui: tokens e
 * credenciais devem ficar no backend (API Symfony/API Platform).
 */

/** URL base da API, sem barra no final, como `http://192.168.0.10:8080/api/v1`. */
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

/**
 * Sem API configurada, a conta funciona só em modo demonstração (nada é verificado
 * nem enviado). Com a API, cadastro, login, sessão e /me são reais.
 */
export const DEMO_MODE = API_BASE_URL === '';

/**
 * Comunas, feed, publicações e comentários usam a API quando ela está configurada
 * (e os mocks só no modo demonstração). Chamados e parte das interações ainda não foram
 * migrados: continuam com dados fictícios, com ou sem API. Quando um domínio migrar,
 * a chamada real entra no `features/<domínio>/api.ts` dele.
 */
export const USE_MOCKS = true;

/** Latência simulada dos mocks, para exercitar estados de carregamento. */
export const MOCK_LATENCY_MS = 400;

/**
 * Tempo máximo de espera por uma resposta da API. Em desenvolvimento é maior: a API local
 * em modo dev, rodando de uma pasta do Windows montada no Docker, leva de 8 a 20 s por requisição.
 */
export const API_TIMEOUT_MS = __DEV__ ? 60000 : 15000;
