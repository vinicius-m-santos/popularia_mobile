import { useCallback, useRef, useState } from 'react';
import type { GestureResponderEvent } from 'react-native';

/** Mesmo tempo do long press anterior: segurar continua sendo um gesto rápido e voluntário. */
export const VIDEO_HOLD_DELAY_MS = 220;

/**
 * Deslocamento tolerado antes de o toque ser lido como arrasto.
 *
 * Fica abaixo do slop nativo do scroll (e da tolerância de 10 do `Pressable`).
 * Assim um scroll lento perde o 2× antes de a lista assumir o gesto, sem exigir
 * que a pessoa fique com o dedo perfeitamente parado para acelerar o vídeo.
 */
export const VIDEO_HOLD_MOVE_TOLERANCE = 6;

type Point = { x: number; y: number };

function pointOf(event?: GestureResponderEvent): Point | null {
  const native = event?.nativeEvent;
  if (!native) return null;
  if (typeof native.pageX === 'number' && typeof native.pageY === 'number') {
    return { x: native.pageX, y: native.pageY };
  }
  const touch = native.touches?.[0];
  return touch && typeof touch.pageX === 'number' && typeof touch.pageY === 'number'
    ? { x: touch.pageX, y: touch.pageY }
    : null;
}

/**
 * Long press do vídeo que falha quando o dedo vira arrasto.
 *
 * O `Pressable` já cancela o long press a 10 de deslocamento, mas o timer de
 * 220 ms pode disparar antes de a lista capturar o responder. Esta guarda
 * observa os movimentos do próprio toque e:
 *
 * - impede o 2× quando o arrasto começou antes do tempo;
 * - encerra o 2× na hora se o arrasto começar depois de o long press ativar;
 * - encerra no `pressOut`, que também chega quando o scroll assume o gesto.
 *
 * `pressed` começa nulo para um long press acionado sem `pressIn` (testes e
 * acessibilidade). Depois de um `pressOut` real, um callback atrasado não
 * reativa a velocidade.
 */
export function useVideoHold(onStart: () => void, onEnd: () => void) {
  const [holding, setHolding] = useState(false);
  const origin = useRef<Point | null>(null);
  const moved = useRef(false);
  const holdingRef = useRef(false);
  const pressed = useRef<boolean | null>(null);

  const end = useCallback(() => {
    origin.current = null;
    if (!holdingRef.current) return;
    holdingRef.current = false;
    setHolding(false);
    onEnd();
  }, [onEnd]);

  const begin = useCallback((event: GestureResponderEvent) => {
    pressed.current = true;
    moved.current = false;
    origin.current = pointOf(event);
  }, []);

  const track = useCallback((event: GestureResponderEvent) => {
    const start = origin.current;
    if (!start) return;
    const point = pointOf(event);
    if (!point) return;
    if (Math.hypot(point.x - start.x, point.y - start.y) <= VIDEO_HOLD_MOVE_TOLERANCE) return;
    moved.current = true;
    // A lista já está levando o toque embora: desfaz o 2× mesmo antes de o
    // responder ser terminado.
    if (holdingRef.current) end();
  }, [end]);

  const activate = useCallback((event?: GestureResponderEvent) => {
    if (pressed.current === false || moved.current || holdingRef.current) return false;
    // Sem `pressIn` (ou sem coordenadas nele), o próprio long press ancora os
    // movimentos seguintes.
    origin.current ??= pointOf(event);
    holdingRef.current = true;
    setHolding(true);
    onStart();
    return true;
  }, [onStart]);

  const stop = useCallback(() => {
    pressed.current = false;
    moved.current = false;
    end();
  }, [end]);

  return { holding, begin, track, activate, stop };
}
