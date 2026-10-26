import { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Kicker } from '@/components/kicker';
import { DEMO_MODE } from '@/constants/config';
import { Spacing } from '@/constants/theme';
import { getWeekEvents } from '@/features/feed/api';
import { useAsyncData } from '@/hooks/use-async-data';

import { EVENT_CARD_WIDTH, EventCard } from './event-card';

/**
 * Faixa horizontal "Chamados da semana". Se falhar, some sem derrubar o feed.
 * Os chamados ainda não existem na API: com ela configurada, o título avisa que são fictícios.
 */
export function WeekEvents() {
  const load = useCallback(() => getWeekEvents(), []);
  const events = useAsyncData(load);

  if (events.status === 'error' || (events.status === 'success' && events.data?.length === 0)) {
    return null;
  }

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Kicker label={DEMO_MODE ? 'Chamados da semana' : 'Chamados da semana · fictícios'} />
      </View>
      {events.data ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={EVENT_CARD_WIDTH + Spacing.two + 2}
          decelerationRate="fast"
          contentContainerStyle={styles.row}>
          {events.data.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </ScrollView>
      ) : (
        <AppText variant="caption" style={styles.loading}>
          Carregando chamados…
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
  },
  heading: {
    paddingHorizontal: Spacing.five,
    paddingBottom: Spacing.two + 2,
  },
  row: {
    paddingHorizontal: Spacing.five,
    gap: Spacing.two + 2,
  },
  loading: {
    paddingHorizontal: Spacing.five,
    minHeight: 148,
  },
});
