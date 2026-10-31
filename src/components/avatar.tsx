import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Colors, Fonts } from '@/constants/theme';
import { queryClient } from '@/lib/query/client';
import type { Tone } from '@/types/models';

export type AvatarColor = { bg: string; fg: string };

/** Cores por tom, como no design. Sem foto, o avatar continua com as iniciais. */
export const TONE_COLORS: Record<Tone, AvatarColor> = {
  red: { bg: Colors.red, fg: Colors.paper },
  black: { bg: Colors.ink, fg: Colors.cream },
  cream: { bg: Colors.straw, fg: Colors.ink },
};

/**
 * Identidade de quem não tem foto. São 14 fundos estáveis: o hash do ID escolhe a cor,
 * então a mesma pessoa aparece sempre com a mesma cor no feed, nos comentários e no perfil.
 * A paleta é editorial (tinta, tijolo, oliva, mostarda) e não substitui as cores das comunas.
 */
export const AVATAR_COLORS: AvatarColor[] = [
  TONE_COLORS.red,
  TONE_COLORS.black,
  TONE_COLORS.cream,
  { bg: '#E0B23C', fg: Colors.ink }, // mostarda
  { bg: '#7C8B4F', fg: Colors.paper }, // oliva
  { bg: '#2F6F6B', fg: Colors.paper }, // verde-água
  { bg: '#B5533C', fg: Colors.paper }, // tijolo
  { bg: '#4A5A6A', fg: Colors.paper }, // ardósia
  { bg: '#6B4A63', fg: Colors.paper }, // ameixa
  { bg: '#A65B2A', fg: Colors.paper }, // ferrugem
  { bg: '#A8B89A', fg: Colors.ink }, // sálvia
  { bg: '#44618C', fg: Colors.paper }, // jeans
  { bg: '#C98A8A', fg: Colors.ink }, // rosa
  { bg: '#5C6B45', fg: Colors.paper }, // musgo
];

/** Hash FNV-1a: espalha os IDs pela paleta, mas devolve sempre a mesma cor para a mesma pessoa. */
export function avatarColorFor(id: string | null | undefined): AvatarColor | null {
  if (!id) return null;
  let hash = 0x811c9dc5;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return AVATAR_COLORS[(hash >>> 0) % AVATAR_COLORS.length] ?? TONE_COLORS.cream;
}

/** Cor de identidade da pessoa; sem ID, cai no tom editorial do modelo. */
export function avatarPalette(id: string | null | undefined, tone: Tone): AvatarColor {
  return avatarColorFor(id) ?? TONE_COLORS[tone];
}

type AvatarProps = {
  initials: string;
  tone: Tone;
  size?: number;
  /** Contorno creme, para avatares sobrepostos. */
  ring?: boolean;
  /** Forma do avatar. No cartão de publicação a identidade é um selo quadrado. */
  shape?: 'circle' | 'square';
  /** Contorno de tinta, como no selo de autoria do feed. */
  outline?: boolean;
  /** Anton dá o desenho condensado do selo; a redonda fica para os avatares pequenos. */
  font?: 'condensed' | 'anton';
  /** Foto já resolvida. Um arquivo local tem prioridade sobre o cache. */
  imageUrl?: string | null;
  /** Quando a pessoa troca a foto, avatares com o mesmo id acompanham sem refetch. */
  userId?: string;
};

function useAvatarUrl(userId: string | undefined, imageUrl: string | null | undefined): string | null {
  const cached = useQuery({
    queryKey: ['user-avatar', userId ?? ''],
    enabled: false,
    queryFn: () => null as string | null,
    staleTime: Infinity,
    gcTime: Infinity,
  }, queryClient);
  if (imageUrl && /^(file|content|blob|ph|assets-library):/.test(imageUrl)) return imageUrl;
  if (userId && cached.dataUpdatedAt > 0 && typeof cached.data === 'string') return cached.data;
  return imageUrl ?? null;
}

/** Avatar com foto ou iniciais. É decorativo: o nome fica no texto ao lado. */
export function Avatar({ initials, tone, size = 40, ring = false, shape = 'circle', outline = false, font = 'condensed', imageUrl = null, userId }: AvatarProps) {
  const { bg, fg } = avatarPalette(userId, tone);
  const resolved = useAvatarUrl(userId, imageUrl);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = !!resolved && failedUrl !== resolved;
  const radius = shape === 'square' ? Math.max(4, Math.round(size * 0.14)) : size / 2;
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: radius, backgroundColor: bg },
        outline ? styles.outline : ring ? styles.ring : null,
      ]}
      accessible={false}
      importantForAccessibility="no-hide-descendants">
      <AppText
        style={[styles.initials, font === 'anton' ? styles.anton : null, { fontSize: size * (font === 'anton' ? 0.4 : 0.35), lineHeight: size * (font === 'anton' ? 0.5 : 0.45) }]}
        color={fg}
        maxFontSizeMultiplier={1}>
        {initials}
      </AppText>
      {showImage ? <Image
        source={{ uri: resolved }}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={resolved}
        transition={0}
        onError={() => setFailedUrl(resolved)}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      /> : null}
    </View>
  );
}

type AvatarStackProps = {
  people: { id: string; initials: string; tone: Tone }[];
  size?: number;
};

export function AvatarStack({ people, size = 30 }: AvatarStackProps) {
  return (
    <View style={styles.stack} accessible={false} importantForAccessibility="no-hide-descendants">
      {people.map((p) => (
        <View key={p.id} style={styles.stackItem}>
          <Avatar initials={p.initials} tone={p.tone} size={size} ring userId={p.id} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    borderWidth: 2,
    borderColor: Colors.cream,
  },
  outline: {
    borderWidth: 2,
    borderColor: Colors.ink,
  },
  initials: {
    fontFamily: Fonts.condensed,
  },
  anton: {
    fontFamily: Fonts.anton,
  },
  stack: {
    flexDirection: 'row',
    paddingRight: 8,
  },
  stackItem: {
    marginRight: -8,
  },
});
