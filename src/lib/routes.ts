import { router, useSegments, type Href } from 'expo-router';
import { useMemo } from 'react';

/**
 * Cada aba tem a própria pilha com comuna, discussão e perfil, em endereços
 * distintos (`/comuna/x`, `/explorar/comuna/x`…). Assim, abrir uma comuna a
 * partir do Explorar continua na aba Explorar, como no design.
 */
export type TabBase = '' | '/explorar' | '/avisos' | '/perfil';

const TAB_SEGMENTS = ['explorar', 'avisos', 'perfil'] as const;

function tabBaseOf(segments: string[]): TabBase {
  // Rotas das abas: ['(tabs)', 'explorar', 'comuna', '[id]']. Fora das abas, usa a pilha do Início.
  const tab = segments[0] === '(tabs)' ? segments[1] : segments[0] === 'avisos' ? 'avisos' : undefined;
  return TAB_SEGMENTS.find((t) => t === tab) ? (`/${tab}` as TabBase) : '';
}

export function hrefPost(base: TabBase, id: string): Href {
  return `${base}/post/${encodeURIComponent(id)}` as Href;
}

/** Aba inicial da página da comuna. */
export type ComunaTab = 'posts' | 'regras' | 'membros';

export function hrefComuna(base: TabBase, id: string, tab?: ComunaTab): Href {
  return `${base}/comuna/${encodeURIComponent(id)}${tab ? `?aba=${tab}` : ''}` as Href;
}

export type RelationKind = 'seguidores' | 'seguindo';

export function hrefRelations(base: TabBase, kind: RelationKind, id: string): Href {
  return `${base}/relacoes/${kind}/${encodeURIComponent(id)}` as Href;
}

export function hrefProfile(base: TabBase, id: string): Href {
  // O próprio perfil tem aba; dentro dela, não empilha uma cópia.
  if (id === 'me') return '/perfil';
  return `${base}/pessoa/${encodeURIComponent(id)}` as Href;
}

/** Navegação para as telas de detalhe, na pilha da aba em que a pessoa está. */
export function useNav() {
  const segments = useSegments() as string[];
  const base = tabBaseOf(segments);
  return useMemo(
    () => ({
      openPost: (id: string) => router.push(hrefPost(base, id)),
      openComuna: (id: string, tab?: ComunaTab) => router.push(hrefComuna(base, id, tab)),
      openProfile: (id: string) =>
        id === 'me' ? router.navigate('/perfil') : router.push(hrefProfile(base, id)),
      openRelations: (kind: RelationKind, id: string) => router.push(hrefRelations(base, kind, id)),
    }),
    [base],
  );
}

/** Fila de moderação de uma comuna. Fica fora das abas, sem a barra inferior (2k). */
export function openModeration(comunaId: string) {
  router.push({ pathname: '/moderacao/[id]', params: { id: comunaId } });
}

/** Fila global. O servidor recusa quem não é moderação da plataforma. */
export function openPlatformModeration() {
  router.push('/moderacao-plataforma' as Href);
}

/** Gestão de uma comuna (proprietário e moderação). Fora das abas, como a moderação. */
export function openManageComuna(comunaId: string) {
  router.push({ pathname: '/gerir-comuna/[id]', params: { id: comunaId } });
}

/** Formulário de nova comuna (modal). */
export function openCreateComuna() {
  router.push('/criar-comuna');
}

/** Volta, ou vai ao feed se a tela foi aberta direto por link. */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
