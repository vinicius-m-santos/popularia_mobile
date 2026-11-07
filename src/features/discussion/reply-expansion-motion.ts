import { useCallback, useEffect, useRef } from 'react';
import { LayoutAnimation, useWindowDimensions } from 'react-native';

import { Motion } from '@/constants/motion';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

/**
 * Animação de altura/posição da expansão de respostas.
 *
 * O Fabric exige `property` nos configs de criação e remoção. Usamos opacidade
 * com duração 0 nesses dois canais: a linha entra/sai opaca e o que anima é só
 * a posição/altura das linhas vizinhas. O texto nunca fica ilegível durante a
 * transição e a leitura não depende da animação terminar.
 */
export const REPLY_EXPANSION_ANIMATION = {
  duration: Motion.duration.normal,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
    duration: 0,
  },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
    duration: 0,
  },
} as const;

/**
 * Limites conservadores para o custo da animação de layout.
 *
 * Listas recicladas não devem animar uma inserção grande: quanto mais células
 * mudam de posição no mesmo commit, maior o risco de jank. Acima destes limites
 * a expansão acontece instantaneamente, que é o fallback sem movimento.
 * Os valores são escolhas de design, não medições de FPS.
 */
export const REPLY_EXPANSION_LIMITS = {
  /** Uma única expansão de até 12 respostas continua legível e barata. */
  maxReplies: 12,
  /** Acima de 120 linhas no total, a lista é considerada longa e não anima. */
  maxRows: 120,
  /** Com fonte ampliada a expansão fica alta demais para animar sem perder o ponto. */
  maxFontScale: 1.3,
} as const;

type ReplyExpansionInput = {
  /** Respostas do comentário no estado atual. */
  replyCount: number;
  /** Total de linhas da discussão antes da troca. */
  rowCount: number;
  /** `true` quando o grupo está oculto e vai abrir. */
  collapsed: boolean;
};

/**
 * Decide se a troca cabe no orçamento de animação. Separado do hook para ser
 * testável sem layout nativo e para documentar o fallback.
 */
export function shouldAnimateReplyExpansion({
  reducedMotion,
  fontScale = 1,
  replyCount,
  rowCount,
  collapsed,
}: ReplyExpansionInput & { reducedMotion: boolean; fontScale?: number }): boolean {
  if (reducedMotion || fontScale > REPLY_EXPANSION_LIMITS.maxFontScale || replyCount <= 0) return false;
  if (replyCount > REPLY_EXPANSION_LIMITS.maxReplies) return false;
  const nextRowCount = rowCount + (collapsed ? replyCount : -replyCount);
  return Math.max(rowCount, nextRowCount) <= REPLY_EXPANSION_LIMITS.maxRows;
}

/**
 * Agenda a animação da próxima troca de colapso/expansão. O callback é
 * estável: a preferência de movimento reduzido e a escala de fonte são lidas
 * por ref para não trocar a identidade de `onToggleCollapse` e re-renderizar
 * todas as linhas.
 */
export function useReplyExpansionMotion() {
  const reducedMotion = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const reducedRef = useRef(reducedMotion);
  const fontScaleRef = useRef(fontScale);

  useEffect(() => {
    reducedRef.current = reducedMotion;
    fontScaleRef.current = fontScale;
  }, [fontScale, reducedMotion]);

  return useCallback((input: ReplyExpansionInput) => {
    if (!shouldAnimateReplyExpansion({
      ...input,
      reducedMotion: reducedRef.current,
      fontScale: fontScaleRef.current,
    })) return false;
    LayoutAnimation.configureNext(REPLY_EXPANSION_ANIMATION);
    return true;
  }, []);
}
