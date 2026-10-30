import { Image, type ImageProps, type ImageRef } from 'expo-image';
import { useSyncExternalStore } from 'react';

// Apenas as quatro ilustrações recorrentes do menu central. Nenhuma mídia de usuário.
const sources = {
  hero: require('@/assets/create/create-hero-optimized.png'),
  publication: require('@/assets/create/create-publication-optimized.png'),
  pdf: require('@/assets/create/create-pdf-optimized.png'),
  comuna: require('@/assets/create/create-comuna-optimized.png'),
};
export type CreationAsset = keyof typeof sources;
const decoded: Partial<Record<CreationAsset, ImageRef>> = {};
const listeners = new Set<() => void>();
let warming: Promise<void> | undefined;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/** Decodifica antes do tap e retém referências nativas pequenas (~2,7 MiB no máximo). */
export function warmCreationAssets(): Promise<void> {
  return warming ??= Promise.all((Object.keys(sources) as CreationAsset[]).map(async (name) => {
    try {
      decoded[name] = await Image.loadAsync(sources[name], { maxWidth: name === 'hero' ? 640 : 288 });
      listeners.forEach((listener) => listener());
    } catch {
      // Falha de preload não bloqueia startup nem a abertura; o require continua disponível.
    }
  })).then(() => undefined);
}

export function CreationIllustration({ asset, ...props }: Omit<ImageProps, 'source'> & { asset: CreationAsset }) {
  const source = useSyncExternalStore(subscribe, () => decoded[asset] ?? sources[asset], () => sources[asset]);
  return <Image {...props} source={source} transition={0} cachePolicy="memory" accessible={false} />;
}
