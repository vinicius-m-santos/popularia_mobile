import { Image, type ImageLoadEventData, type ImageRef } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, clamp, ReduceMotion, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { StripedPlaceholder } from '@/components/striped-placeholder';
import { Motion } from '@/constants/motion';
import { Colors, Spacing } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { haptic } from '@/lib/haptics';
import { performanceNow, recordPhotoDisplayed, recordPhotoError, recordPhotoLoaded, recordPhotoOpen } from '@/lib/performance';

import {
  clampPan,
  dismissTarget,
  dragBackdropOpacity,
  panLimit,
  pinchZoom,
  shouldDismiss,
  type ViewerGeometry,
} from './photo-viewer-geometry';
import { travelDestination, validWindowRect, type WindowRect } from './photo-viewer-transition';

const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.5;
/**
 * Acima deste total de pixels, a original é decodificada no tamanho da view.
 * O upload normaliza fotos em 2048 × 2048 (4,19 MP), então o caminho comum
 * mantém a resolução inteira para o zoom; arquivos legados muito maiores não
 * arriscam um bitmap grande demais.
 */
const MAX_FULL_DECODE_PIXELS = 2048 * 2048;
// Assentar, duplo toque e descarte são transições automáticas: com movimento
// reduzido no sistema, o Reanimated aplica o valor final sem animar.
const SETTLE = { duration: 180, reduceMotion: ReduceMotion.System };
const DOUBLE_TAP_SETTLE = { duration: 220, reduceMotion: ReduceMotion.System };
const DISMISS_SETTLE = { duration: 220, reduceMotion: ReduceMotion.System };
/** Volta ao centro com mola: acompanha a velocidade da soltura sem travar. */
const RETURN_SPRING = {
  damping: 18,
  stiffness: 220,
  mass: 0.9,
  reduceMotion: ReduceMotion.System,
};
/**
 * Continuação do thumbnail no quadro final. É uma transição automática de
 * abertura, então segue a mesma preferência de movimento do restante da tela.
 */
const TRAVEL_TIMING = { duration: 240, easing: Motion.easing.standard, reduceMotion: ReduceMotion.System };
/**
 * Se a viewport não medir (ex.: montagem interrompida), a camada de transição
 * não pode deixar a foto escondida. O prazo é curto para o fallback nunca
 * parecer um travamento.
 */
const TRAVEL_START_TIMEOUT_MS = 200;

/**
 * Foto em tela cheia sobre tinta, dentro da área útil (nunca sob o recorte),
 * com pincel para ampliar, arrasto para percorrer e toque duplo para alternar o zoom.
 * O chrome fica embaixo, sempre alcançável: é a saída garantida da tela.
 */
export function PhotoViewer({ uri, preview = null, mediaId, visible, onClose, width, height, origin = null }: {
  uri: string | null;
  /**
   * Variante reduzida já decodificada, usada como camada de transição sob a
   * original. O contrato de mídia não oferece thumbnail de servidor.
   */
  preview?: ImageRef | null;
  /** Identificador estável para a instrumentação local, nunca a URL. */
  mediaId?: string;
  visible: boolean;
  onClose: () => void;
  width?: number;
  height?: number;
  /**
   * Retângulo do thumbnail na janela, medido no toque. Quando existe, a foto
   * percorre essa origem até o quadro final; sem ele (cache frio, web, medida
   * inválida ou célula reciclada) o `Modal` mantém o fade de fallback.
   */
  origin?: WindowRect | null;
}) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [fold, setFold] = useState<ViewerGeometry>({ viewportWidth: 0, viewportHeight: 0, fitWidth: 0, fitHeight: 0 });
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const openStartedAt = useRef<number | null>(null);
  const loadRecorded = useRef(false);
  const displayRecorded = useRef(false);
  const geometry = useSharedValue<ViewerGeometry>({ viewportWidth: 0, viewportHeight: 0, fitWidth: 0, fitHeight: 0 });
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const baseX = useSharedValue(0);
  const baseY = useSharedValue(0);
  // Foco dos dedos capturado no início da pinça, relativo à área útil.
  const pinchFocalX = useSharedValue(-1);
  const pinchFocalY = useSharedValue(-1);
  // Instante do último movimento (pinça ou arrasto): gesto de movimento nunca vira toque duplo.
  const lastMoveAt = useSharedValue(0);
  // O fechamento animado termina na UI thread e só então devolve o callback.
  const closing = useSharedValue(false);
  // Uma pinça no mesmo contato nunca pode ser confundida com arrasto de descarte.
  const pinchActive = useSharedValue(false);
  const pinchTouched = useSharedValue(false);
  // Só um arrasto que realmente deslocou a foto precisa de retorno ao centro.
  const dismissDragged = useSharedValue(false);

  // A origem é um snapshot do toque, não um ref da célula: se a lista reciclar
  // o cartão, este visualizador continua com o retângulo da foto que abriu.
  const measuredOrigin = useMemo(() => validWindowRect(origin), [origin]);
  const insetTop = insets.top;
  const insetLeft = insets.left;
  const travelEligible = visible && measuredOrigin !== null && !!uri && !reducedMotion;
  const [travelPhase, setTravelPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const travelSession = useRef(0);
  const travelX = useSharedValue(measuredOrigin?.x ?? 0);
  const travelY = useSharedValue(measuredOrigin?.y ?? 0);
  const travelWidth = useSharedValue(measuredOrigin?.width ?? 0);
  const travelHeight = useSharedValue(measuredOrigin?.height ?? 0);
  // O backdrop escurece junto com a camada de transição, em vez de cobrir o
  // feed de uma vez. No caminho sem transição ele já nasce opaco como antes.
  const reveal = useSharedValue(travelEligible ? 0 : 1);

  const ratio = width && height ? width / height : 3 / 2;
  // O contrato limita a foto a 2048 × 2048; nesse intervalo decodificamos a
  // original inteira para o zoom não herdar a resolução do feed.
  const keepsFullResolution = !!width && !!height && width * height <= MAX_FULL_DECODE_PIXELS;

  // Até a camada chegar ao quadro final, o conteúdo normal fica invisível. Se
  // não há transição, ele aparece imediatamente com o fade nativo de sempre.
  const showMain = !travelEligible || travelPhase === 'done';

  // Sair zera zoom e deslocamento: a próxima foto sempre abre inteira e o
  // backdrop volta opaco, sem herdar o estado do descarte anterior.
  const reset = () => {
    cancelAnimation(scale);
    cancelAnimation(translateX);
    cancelAnimation(translateY);
    scale.value = 1;
    translateX.value = 0; translateY.value = 0;
    baseX.value = 0; baseY.value = 0;
    pinchFocalX.value = -1; pinchFocalY.value = -1;
    pinchActive.value = false;
    pinchTouched.value = false;
    dismissDragged.value = false;
    closing.value = false;
    setStatus('loading');
  };

  const finishDismiss = () => {
    // O callback é a conclusão do fluxo: o backdrop já está transparente e a
    // foto saiu da área útil. A limpeza acontece na próxima abertura.
    onClose();
  };

  const requestClose = () => {
    // Fechar pelo botão/back cancela uma animação em voo para o callback de
    // descarte não fechar a tela duas vezes e não deixa o gesto bloqueado.
    cancelAnimation(scale);
    cancelAnimation(translateX);
    cancelAnimation(translateY);
    closing.value = false;
    onClose();
  };

  const measure = (next: ViewerGeometry) => {
    geometry.value = next;
    setFold((previous) => (
      previous.viewportWidth === next.viewportWidth
      && previous.viewportHeight === next.viewportHeight
      && previous.fitWidth === next.fitWidth
      && previous.fitHeight === next.fitHeight
        ? previous
        : next
    ));
  };

  const elapsedSinceOpen = () => {
    const startedAt = openStartedAt.current;
    return startedAt === null ? 0 : performanceNow() - startedAt;
  };

  const onLoad = (event: ImageLoadEventData) => {
    setStatus('ready');
    if (loadRecorded.current) return;
    // O evento também existe na web; sem `source` não há tamanho confiável.
    if (!event?.source) return;
    loadRecorded.current = true;
    recordPhotoLoaded(mediaId ?? 'unknown', {
      elapsedMs: elapsedSinceOpen(),
      width: event.source.width,
      height: event.source.height,
      cacheType: event.cacheType ?? 'none',
    });
  };

  const onDisplay = () => {
    setStatus('ready');
    if (displayRecorded.current) return;
    displayRecorded.current = true;
    recordPhotoDisplayed(mediaId ?? 'unknown', elapsedSinceOpen());
  };

  const onError = () => {
    setStatus('error');
    recordPhotoError(mediaId ?? 'unknown');
  };

  const onLayout = (layoutWidth: number, layoutHeight: number) => {
    if (layoutWidth <= 0 || layoutHeight <= 0) return;
    const viewportRatio = layoutWidth / layoutHeight;
    const fitWidth = ratio > viewportRatio ? layoutWidth : layoutHeight * ratio;
    const fitHeight = fitWidth / ratio;
    measure({ viewportWidth: layoutWidth, viewportHeight: layoutHeight, fitWidth, fitHeight });
    // Girar o aparelho muda a área útil e pode encolher o limite: recoloca a
    // imagem dentro das bordas sem animar junto com a rotação.
    const nextX = clampPan(translateX.value, scale.value, fitWidth, layoutWidth);
    const nextY = clampPan(translateY.value, scale.value, fitHeight, layoutHeight);
    if (nextX !== translateX.value || nextY !== translateY.value) {
      translateX.value = nextX; translateY.value = nextY;
      baseX.value = nextX; baseY.value = nextY;
    }
  };

  const finishTravel = useCallback((session: number) => {
    if (session !== travelSession.current) return;
    setTravelPhase('done');
  }, []);

  /*
   * Os shared values do Reanimated são um store externo ao estado do React: a
   * animação começa no layout effect, quando a viewport já mediu, e o callback
   * de conclusão devolve a fase para o React. O React Compiler não conhece esse
   * store e trata as escritas como mutação de valor imutável.
   */
  /* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect */
  // Fechar invalida a sessão em voo e devolve o backdrop opaco: uma reabertura
  // começa da nova origem medida, nunca do destino da foto anterior.
  useLayoutEffect(() => {
    if (visible) return;
    travelSession.current += 1;
    cancelAnimation(travelX);
    cancelAnimation(travelY);
    cancelAnimation(travelWidth);
    cancelAnimation(travelHeight);
    cancelAnimation(reveal);
    reveal.value = 1;
    setTravelPhase('idle');
  }, [visible, reveal, travelHeight, travelWidth, travelX, travelY]);

  // Uma única partida por abertura, depois que a viewport mediu. O destino sai
  // da área útil real; a origem é o snapshot do toque.
  useLayoutEffect(() => {
    if (!travelEligible) {
      // Fallback (cache frio, web, medida inválida, Reduce Motion ou fechando):
      // o backdrop precisa ficar opaco. Marcar a fase como concluída também
      // impede uma transição tardia se a origem chegar depois.
      reveal.value = 1;
      if (visible) setTravelPhase((phase) => (phase === 'idle' ? 'done' : phase));
      return;
    }
    if (travelPhase !== 'idle' || !measuredOrigin) return;
    const destination = travelDestination({
      viewportWidth: fold.viewportWidth,
      viewportHeight: fold.viewportHeight,
      fitWidth: fold.fitWidth,
      fitHeight: fold.fitHeight,
    }, { top: insetTop, left: insetLeft });
    if (!destination) return;

    const session = travelSession.current + 1;
    travelSession.current = session;
    travelX.value = measuredOrigin.x;
    travelY.value = measuredOrigin.y;
    travelWidth.value = measuredOrigin.width;
    travelHeight.value = measuredOrigin.height;
    reveal.value = 0;
    setTravelPhase('running');

    travelX.value = withTiming(destination.x, TRAVEL_TIMING);
    travelY.value = withTiming(destination.y, TRAVEL_TIMING);
    travelHeight.value = withTiming(destination.height, TRAVEL_TIMING);
    reveal.value = withTiming(1, TRAVEL_TIMING);
    // A largura é a última a terminar; o callback é a conclusão da sessão.
    travelWidth.value = withTiming(destination.width, TRAVEL_TIMING, (finished) => {
      'worklet';
      if (!finished) return;
      runOnJS(finishTravel)(session);
    });
  }, [finishTravel, fold.fitHeight, fold.fitWidth, fold.viewportHeight, fold.viewportWidth, insetLeft, insetTop, measuredOrigin, reveal, travelEligible, travelHeight, travelPhase, travelWidth, travelX, travelY, visible]);

  // Se a preferência mudar com a transição em voo, o estado final aparece de
  // imediato; nenhuma animação automática continua com Reduce Motion ligado.
  useLayoutEffect(() => {
    if (!reducedMotion || travelPhase !== 'running') return;
    travelSession.current += 1;
    cancelAnimation(travelX);
    cancelAnimation(travelY);
    cancelAnimation(travelWidth);
    cancelAnimation(travelHeight);
    cancelAnimation(reveal);
    reveal.value = 1;
    setTravelPhase('done');
  }, [reducedMotion, reveal, travelHeight, travelPhase, travelWidth, travelX, travelY]);

  // A viewport pode não medir em uma montagem interrompida. Sem este prazo, a
  // camada de transição deixaria o conteúdo normal invisível.
  useEffect(() => {
    if (!visible || travelPhase !== 'idle' || !measuredOrigin || reducedMotion) return;
    const timer = setTimeout(() => {
      setTravelPhase((phase) => (phase === 'idle' ? 'done' : phase));
    }, TRAVEL_START_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [measuredOrigin, reducedMotion, travelPhase, visible]);
  /* eslint-enable react-hooks/immutability, react-hooks/set-state-in-effect */

  const pinch = usePinchGesture({
    // O zoom parte do valor que está na tela e anda com o delta de cada evento
    // (`scaleChange`). Antes, uma base fixa multiplicada pelo `scale` acumulado do
    // gesto fazia o recolhimento rápido "bater" no mínimo e voltar.
    onBegin: () => {
      'worklet';
      // Zera o foco: se a plataforma não entregar o ponto no `onActivate`, a
      // pinça cai no centro em vez de reaproveitar o foco do gesto anterior.
      pinchFocalX.value = -1;
      pinchFocalY.value = -1;
      pinchActive.value = true;
      pinchTouched.value = true;
      cancelAnimation(scale);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
    },
    // O foco é o ponto entre os dedos no começo da pinça. Ele fica parado na
    // tela; a translação compensa cada mudança de escala em volta dele.
    onActivate: (event) => {
      'worklet';
      pinchActive.value = true;
      pinchTouched.value = true;
      pinchFocalX.value = event.focalX;
      pinchFocalY.value = event.focalY;
    },
    onUpdate: (event) => {
      'worklet';
      lastMoveAt.value = Date.now();
      const view = geometry.value;
      const focalX = pinchFocalX.value >= 0 ? pinchFocalX.value : view.viewportWidth / 2;
      const focalY = pinchFocalY.value >= 0 ? pinchFocalY.value : view.viewportHeight / 2;
      const next = pinchZoom(
        scale.value,
        translateX.value,
        translateY.value,
        focalX,
        focalY,
        event.scaleChange,
        view,
        MAX_ZOOM,
      );
      scale.value = next.scale;
      translateX.value = next.translateX;
      translateY.value = next.translateY;
    },
    onDeactivate: () => {
      'worklet';
      lastMoveAt.value = Date.now();
      pinchActive.value = false;
      // Sempre assenta: abaixo do mínimo volta a 1, acima mantém o quadro dentro dos limites.
      if (scale.value <= 1.02) {
        scale.value = withTiming(1, SETTLE);
        translateX.value = withTiming(0, SETTLE);
        translateY.value = withTiming(0, SETTLE);
        baseX.value = 0; baseY.value = 0;
      } else {
        const view = geometry.value;
        const nextX = clampPan(translateX.value, scale.value, view.fitWidth, view.viewportWidth);
        const nextY = clampPan(translateY.value, scale.value, view.fitHeight, view.viewportHeight);
        translateX.value = withTiming(nextX, SETTLE);
        translateY.value = withTiming(nextY, SETTLE);
        baseX.value = nextX; baseY.value = nextY;
      }
    },
    onFinalize: () => {
      'worklet';
      // `onDeactivate` não dispara quando a pinça é cancelada; soltar a flag
      // evita bloquear o próximo arrasto.
      pinchActive.value = false;
    },
  });

  const pan = usePanGesture({
    maxPointers: 1,
    onBegin: () => {
      'worklet';
      if (closing.value) return;
      // Um arrasto novo começa limpo. Se uma pinça ainda está ativa, preserva a
      // marca para este contato não virar descarte ao soltar.
      if (!pinchActive.value) pinchTouched.value = false;
      dismissDragged.value = false;
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      baseX.value = translateX.value;
      baseY.value = translateY.value;
      lastMoveAt.value = Date.now();
    },
    onUpdate: (event) => {
      'worklet';
      if (closing.value || pinchActive.value || pinchTouched.value) return;
      lastMoveAt.value = Date.now();
      const view = geometry.value;
      if (scale.value <= 1.02) {
        // Sem zoom, a foto acompanha o dedo: arrastar é o gesto de descartar.
        dismissDragged.value = true;
        translateX.value = event.translationX * 0.5;
        translateY.value = event.translationY;
        return;
      }
      const limitX = panLimit(scale.value, view.fitWidth, view.viewportWidth);
      const limitY = panLimit(scale.value, view.fitHeight, view.viewportHeight);
      translateX.value = clamp(baseX.value + event.translationX, -limitX, limitX);
      translateY.value = clamp(baseY.value + event.translationY, -limitY, limitY);
    },
    onDeactivate: (event) => {
      'worklet';
      if (closing.value) return;
      lastMoveAt.value = Date.now();
      // A pinça é dona do enquadramento: mesmo que ela volte a 1×, soltar o
      // segundo dedo não pode ser lido como arrasto de descarte.
      if (pinchActive.value || pinchTouched.value) return;
      if (scale.value > 1.02) {
        baseX.value = translateX.value; baseY.value = translateY.value;
        return;
      }
      if (shouldDismiss(translateY.value, event.velocityY)) {
        closing.value = true;
        const target = dismissTarget(translateY.value, geometry.value.viewportHeight);
        translateY.value = withTiming(target, DISMISS_SETTLE, (finished) => {
          'worklet';
          if (!finished) {
            // Outro fechamento/abertura cancelou a animação: libera o gesto sem
            // chamar o callback de um descarte que não terminou.
            closing.value = false;
            return;
          }
          runOnJS(finishDismiss)();
        });
        return;
      }
      translateX.value = withSpring(0, RETURN_SPRING);
      translateY.value = withSpring(0, { ...RETURN_SPRING, velocity: event.velocityY });
      baseX.value = 0; baseY.value = 0;
      dismissDragged.value = false;
    },
    onFinalize: (event) => {
      'worklet';
      if (!event.canceled || !dismissDragged.value || closing.value || pinchActive.value || pinchTouched.value) return;
      // Gesture cancelado (ex.: perdeu a disputa para outro handler) não pode
      // deixar a foto parada no meio do arrasto.
      if (scale.value <= 1.02) {
        translateX.value = withSpring(0, RETURN_SPRING);
        translateY.value = withSpring(0, RETURN_SPRING);
        baseX.value = 0; baseY.value = 0;
        dismissDragged.value = false;
      }
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    maxDelay: 280,
    onDeactivate: (event) => {
      'worklet';
      if (closing.value) return;
      // Puxar forte na beirada solta e recoloca o dedo rápido: se houve movimento agora,
      // esses dois contatos não são um toque duplo.
      if (Date.now() - lastMoveAt.value < 450) return;
      // O zoom assenta num nível inteiro (1× ou 2,5×): um tique de seleção confirma o snap.
      runOnJS(haptic)('selection');
      cancelAnimation(scale);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      const view = geometry.value;
      const next = scale.value > 1 ? 1 : DOUBLE_TAP_ZOOM;
      const limitX = panLimit(next, view.fitWidth, view.viewportWidth);
      const limitY = panLimit(next, view.fitHeight, view.viewportHeight);
      const targetX = next === 1 ? 0 : clamp(-(next - 1) * (event.x - view.viewportWidth / 2), -limitX, limitX);
      const targetY = next === 1 ? 0 : clamp(-(next - 1) * (event.y - view.viewportHeight / 2), -limitY, limitY);
      scale.value = withTiming(next, DOUBLE_TAP_SETTLE);
      translateX.value = withTiming(targetX, DOUBLE_TAP_SETTLE);
      translateY.value = withTiming(targetY, DOUBLE_TAP_SETTLE);
      baseX.value = targetX; baseY.value = targetY;
    },
  });

  const gesture = useSimultaneousGestures(pinch, pan, doubleTap);
  const zoomed = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }] }));
  // O fundo e o chrome somem juntos enquanto a foto acompanha o dedo. O
  // backdrop transparente revela o feed por baixo sem desmontar o Modal. A
  // revelação da abertura multiplica esse valor para a transição não cobrir o
  // feed de uma vez.
  const overlay = useAnimatedStyle(() => ({
    opacity: dragBackdropOpacity(translateY.value, scale.value) * reveal.value,
  }));
  // A camada anda com largura e altura reais para o `cover` recortar a foto do
  // mesmo jeito que o thumbnail no início e no quadro final.
  const travelStyle = useAnimatedStyle(() => ({
    left: travelX.value,
    top: travelY.value,
    width: travelWidth.value,
    height: travelHeight.value,
  }));

  // Cada abertura é uma nova medição: zera as marcas sem criar timer nem
  // observer. A instrumentação é fechada em produção e não recebe a URL.
  useLayoutEffect(() => {
    if (!visible) return;
    openStartedAt.current = performanceNow();
    loadRecorded.current = false;
    displayRecorded.current = false;
    recordPhotoOpen(mediaId ?? 'unknown');
  }, [mediaId, visible]);

  // Com uma origem válida, o conteúdo já nasce pronto e a camada de transição
  // aparece no primeiro quadro: o fade nativo faria a miniatura viajar dentro
  // de um véu. Sem origem (cache frio, web ou medida reciclada), o `Modal`
  // mantém o fade de fallback. Fechar limpa a origem no mesmo commit de
  // `visible=false`, então a saída volta a usar o fade nativo.
  const animationType = reducedMotion || (visible && measuredOrigin) ? 'none' : 'fade';

  return <Modal transparent visible={visible} animationType={animationType} statusBarTranslucent onRequestClose={requestClose} onShow={reset} testID="photo-viewer-modal">
    <GestureHandlerRootView
      testID="photo-viewer-root"
      style={styles.root}
      accessibilityViewIsModal
      onAccessibilityEscape={requestClose}>
      <ResetOnOpen onOpen={reset} />
      <StatusBar hidden />
      <Animated.View testID="photo-viewer-backdrop" pointerEvents="none" style={[styles.backdrop, overlay]} />
      <View style={[styles.screen, { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]}>
        <View
          style={styles.viewport}
          collapsable={false}
          testID="photo-viewer-viewport"
          onLayout={(event) => onLayout(event.nativeEvent.layout.width, event.nativeEvent.layout.height)}>
          <GestureDetector gesture={gesture}>
            <View style={styles.fill} collapsable={false}>
              {fold.fitWidth > 0 && uri ? <Animated.View testID="photo-viewer-fit" style={[styles.fit, { width: fold.fitWidth, height: fold.fitHeight }, zoomed, !showMain && styles.invisible]}>
                <View style={styles.underlay} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <PhotoFallback preview={preview} />
                </View>
                <Image
                  testID="photo-viewer-image"
                  source={{ uri }}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  priority="high"
                  recyclingKey={uri}
                  // A original inteira alimenta o zoom; acima do teto de pixels
                  // o expo-image pode reduzir o bitmap para não estourar memória.
                  allowDownscaling={!keepsFullResolution}
                  // Cache hit aparece direto; cache frio faz cross-dissolve sobre
                  // a listra ou o bitmap do feed, nunca sobre preto. Com movimento
                  // reduzido a troca é imediata.
                  transition={reducedMotion ? null : { duration: 160, skipOnCacheHit: 'all' }}
                  onLoad={onLoad}
                  onDisplay={onDisplay}
                  onError={onError}
                  accessible
                  accessibilityRole="image"
                  accessibilityLabel="Foto da publicação em tela cheia"
                  style={StyleSheet.absoluteFill}
                />
                {status === 'error' ? (
                  <View style={[StyleSheet.absoluteFill, styles.photoError]} pointerEvents="none">
                    <AppText variant="caption" color={Colors.paper}>Não foi possível carregar a imagem.</AppText>
                  </View>
                ) : null}
              </Animated.View> : (
                <View
                  testID="photo-viewer-placeholder"
                  style={[StyleSheet.absoluteFill, !showMain && styles.invisible]}
                  pointerEvents="none"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants">
                  <PhotoFallback preview={preview} />
                </View>
              )}
            </View>
          </GestureDetector>
        </View>
        <Animated.View
          style={[styles.bar, { paddingBottom: Math.max(insets.bottom, Spacing.four) }, overlay, !showMain && styles.invisible]}
          pointerEvents={showMain ? 'auto' : 'none'}
          accessibilityElementsHidden={!showMain}
          importantForAccessibility={showMain ? 'auto' : 'no-hide-descendants'}>
          <AppText variant="label" color={Colors.paper}>Foto</AppText>
          <Pressable
            onPress={requestClose}
            accessibilityRole="button"
            accessibilityLabel="Fechar foto"
            accessibilityHint="Volta para a publicação"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
            <AppText variant="label" color={Colors.paper}>Fechar</AppText>
            <Icon name="close" size={18} color={Colors.paper} />
          </Pressable>
        </Animated.View>
      </View>
      {!showMain && measuredOrigin ? (
        <Animated.View
          testID="photo-viewer-transition"
          pointerEvents="none"
          style={[styles.travel, travelStyle]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <Image
            testID="photo-viewer-transition-image"
            source={preview ?? { uri: uri ?? '' }}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={mediaId ?? uri ?? undefined}
            transition={null}
            accessible={false}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </GestureHandlerRootView>
  </Modal>;
}

/**
 * Camada imediata sob a original. A variante já decodificada aparece antes da
 * foto final; sem ela, a listra da casa ocupa o quadro até a foto chegar.
 * `contain` mantém o mesmo enquadramento do quadro final, que usa a proporção
 * original — a troca não desloca a imagem.
 */
function PhotoFallback({ preview }: { preview: ImageRef | null }) {
  if (preview) {
    return <Image testID="photo-viewer-preview" source={preview} contentFit="contain" style={StyleSheet.absoluteFill} accessible={false} />;
  }
  return (
    <View testID="photo-viewer-stripes" style={StyleSheet.absoluteFill}>
      <StripedPlaceholder label="Foto da publicação" showLabel={false} variant="dark" style={styles.placeholderFill} />
    </View>
  );
}

/**
 * O estado do gesto vive no PhotoViewer, que continua montado entre aberturas.
 * O Modal desmonta os filhos ao fechar; ao remontar, este marcador limpa zoom,
 * deslocamento e flags no mesmo commit, antes de a foto reaparecer.
 */
function ResetOnOpen({ onOpen }: { onOpen: () => void }) {
  const open = useRef(onOpen);
  useLayoutEffect(() => {
    open.current();
  }, []);
  return null;
}

const styles = StyleSheet.create({
  // O Modal é transparente: quem pinta a tela é o backdrop animado, que some
  // junto com o arrasto e deixa o feed aparecer por baixo.
  root: { flex: 1 },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: Colors.ink, opacity: 1 },
  screen: { flex: 1 },
  viewport: { flex: 1, overflow: 'hidden' },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fit: { backgroundColor: Colors.ink },
  // O conteúdo normal espera a camada de transição terminar sem piscar atrás
  // dela; a opacidade é só visual, a viewport continua medindo normalmente.
  invisible: { opacity: 0 },
  travel: { position: 'absolute' },
  underlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  placeholderFill: { flex: 1, borderRadius: 0 },
  photoError: { alignItems: 'center', justifyContent: 'center', padding: Spacing.four, backgroundColor: 'rgba(22,18,15,0.72)' },
  bar: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: Colors.inkRule,
  },
  close: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    marginRight: -Spacing.two,
  },
  pressed: { opacity: Motion.feedback.pressed.opacity },
});
