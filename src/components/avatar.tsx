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
export function Avatar({ initials, tone, size = 40, ring = false, imageUrl = null, userId }: AvatarProps) {
  const { bg, fg } = TONE_COLORS[tone];
  const resolved = useAvatarUrl(userId, imageUrl);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = !!resolved && failedUrl !== resolved;
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
        ring && styles.ring,
      ]}
      accessible={false}
      importantForAccessibility="no-hide-descendants">
      <AppText style={[styles.initials, { fontSize: size * 0.35, lineHeight: size * 0.45 }]} color={fg} maxFontSizeMultiplier={1}>
        {initials}
      </AppText>
      {showImage ? <Image
        source={{ uri: resolved }}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={resolved}
        transition={0}
        onError={() => setFailedUrl(resolved)}
        style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
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
  initials: {
    fontFamily: Fonts.condensed,
  },
  stack: {
    flexDirection: 'row',
    paddingRight: 8,
  },
  stackItem: {
    marginRight: -8,
  },
});
