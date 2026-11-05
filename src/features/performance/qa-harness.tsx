import { useMemo } from 'react';
import { ScrollView } from 'react-native';

import { PostCard } from '@/features/posts/components/post-card';
import { performanceInstrumentationEnabled } from '@/lib/performance';

import { qaMountedCards } from './qa-fixture';

/**
 * Cenário de 20 cartões montados ao mesmo tempo (POP-5).
 *
 * Não é uma rota do app. Monte este componente numa entrada de diagnóstico
 * temporária (development build) quando a instrumentação estiver ligada; em
 * produção o gate devolve vazio e nenhum cartão é montado pelo harness.
 */
export function PerformanceQaHarness() {
  const items = useMemo(() => qaMountedCards(), []);
  if (!performanceInstrumentationEnabled()) return null;
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 64 }}>
      {items.map((item) => (
        // vídeos desligados: o cenário mede fanout de like/rolagem sem player concorrente.
        <PostCard key={item.id} item={item} mediaVisible={false} />
      ))}
    </ScrollView>
  );
}
