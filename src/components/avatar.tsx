import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Colors, Fonts } from '@/constants/theme';
import { queryClient } from '@/lib/query/client';
import type { Tone } from '@/types/models';

/** Cores por tom, como no design. Sem foto, o avatar continua com as iniciais. */
export const TONE_COLORS: Record<Tone, { bg: string; fg: string }> = {
  red: { bg: Colors.red, fg: Colors.paper },
  black: { bg: Colors.ink, fg: Colors.cream },
  cream: { bg: Colors.straw, fg: Colors.ink },
};

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
  const { bg, fg } = TONE_COLORS[tone];
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
          <Avatar initials={p.initials} tone={p.tone} size={size} ring />
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
