import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { Screen } from '@/components/screen';
import { useToast } from '@/components/toast';
import { Colors, Fonts, MaxContentWidth, Radius, Shadows, Spacing } from '@/constants/theme';
import { canonicalUrl } from '@/features/links/destinations';
import { absoluteMediaUrl } from '@/features/media/media-url';
import { goBack } from '@/lib/routes';
import { getLastPublication } from './last-publication';

export default function PublishedScreen() {
  const params = useLocalSearchParams<{ id?: string; text?: string; title?: string; comuna?: string }>();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const post = getLastPublication();
  const text = post?.text || params.text || '';
  const title = post?.title || params.title || '';
  const comuna = post?.comuna?.name ?? params.comuna ?? null;
  const imageUri = post?.attachment?.type === 'image' ? absoluteMediaUrl(post.attachment.url) : null;
  const url = post?.id ? (() => { try { return canonicalUrl({ kind: 'post', id: post.id }); } catch { return null; } })() : null;
  const message = [title, text].filter(Boolean).join('\n\n');
  const link = url ?? 'Popularia';
  const copy = async () => {
    await Clipboard.setStringAsync(url ?? message);
    toast.show('Link copiado.');
  };
  const whatsapp = () => {
    const body = encodeURIComponent(`${message}\n\n${link}`);
    void Linking.openURL(`https://wa.me/?text=${body}`).catch(() => toast.show('Não foi possível abrir o WhatsApp.'));
  };
  const more = async () => {
    try { await Share.share({ message: `${message}\n\n${link}` }); }
    catch { toast.show('Não foi possível compartilhar agora.'); }
  };
  const openMural = () => {
    if (post?.comuna?.id) router.replace({ pathname: '/comuna/[id]', params: { id: post.comuna.id } });
    else router.replace('/');
  };
  return <Screen edges={['top', 'left', 'right']}>
    <View style={styles.topBar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={() => { if (router.canGoBack()) goBack(); else router.replace('/'); }} style={({ pressed }) => [styles.closeBox, pressed && styles.pressed]}>
        <Icon name="close" size={24} />
      </Pressable>
      <AppText variant="label" style={styles.publishedLabel}>Publicado · agora</AppText>
    </View>
    <ScrollView contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} contentContainerStyle={styles.content}>
      <View style={styles.stampWrap}>
        <View style={styles.stampOuter}>
          <View style={styles.stampInner}>
            <AppText style={styles.stampText}>Colado{`\n`}no mural</AppText>
          </View>
        </View>
      </View>
      <AppText style={styles.message}>Seu post já tá no mural {comuna ? <>da <AppText style={styles.messageStrong}>c/ {comuna}</AppText></> : <>do seu perfil</>}.</AppText>

      <View style={styles.cardWrap}>
        <View style={styles.tape} />
        <Pressable accessibilityRole="button" accessibilityLabel="Abrir publicação" onPress={() => { if (post?.id) router.push({ pathname: '/post/[id]', params: { id: post.id } }); }} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
          <View style={styles.cardHeader}>
            <AppText style={styles.cardComuna} color={Colors.cream} numberOfLines={1}>{comuna ? `c/ ${comuna}` : 'Seu perfil'}</AppText>
            <AppText style={styles.cardWhen} color={Colors.onInkMuted}>Agora</AppText>
          </View>
          <View style={styles.cardBody}>
            <View style={styles.cardCopy}>
              {title ? <AppText style={styles.cardTitle} numberOfLines={2}>{title}</AppText> : null}
              <AppText style={styles.cardText} numberOfLines={4}>{text || 'Publicação no mural.'}</AppText>
            </View>
            {imageUri ? <Image source={{ uri: imageUri }} contentFit="cover" style={styles.cardImage} /> : <View style={styles.cardImageEmpty} />}
          </View>
        </Pressable>
      </View>

      <AppText variant="label" style={styles.shareLabel}>Chama mais gente</AppText>
      <View style={styles.shareRow}>
        <ShareButton icon="link" label="Copiar link" onPress={() => { void copy(); }} />
        <ShareButton icon="comment" label="WhatsApp" onPress={whatsapp} />
        <ShareButton icon="share" label="Mais" onPress={() => { void more(); }} />
      </View>
    </ScrollView>

    <Pressable accessibilityRole="button" accessibilityLabel="Ver no mural" onPress={openMural} style={({ pressed }) => [styles.muralBar, { paddingBottom: Math.max(insets.bottom, Spacing.three) }, pressed && styles.pressed]}>
      <AppText style={styles.muralLabel}>Ver no mural</AppText>
      <Icon name="arrowRight" size={26} color={Colors.paper} />
    </Pressable>
  </Screen>;
}

function ShareButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}>
    <Icon name={icon} size={22} />
    <AppText style={styles.shareButtonLabel}>{label}</AppText>
  </Pressable>;
}

const styles = StyleSheet.create({
  topBar: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.five, paddingVertical: Spacing.two },
  closeBox: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, backgroundColor: Colors.paper },
  publishedLabel: { letterSpacing: 1.5 },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: Spacing.five, paddingBottom: Spacing.six, gap: Spacing.five },
  stampWrap: { alignItems: 'center', paddingTop: Spacing.four },
  stampOuter: { borderWidth: 3, borderColor: Colors.red, borderRadius: Radius.sm, padding: 5, transform: [{ rotate: '-4deg' }] },
  stampInner: { borderWidth: 2, borderColor: Colors.red, borderRadius: 2, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  stampText: { fontFamily: Fonts.anton, fontSize: 45, lineHeight: 48, letterSpacing: 0.4, textAlign: 'center', textTransform: 'uppercase', color: Colors.red },
  message: { fontSize: 18, lineHeight: 25, textAlign: 'center' },
  messageStrong: { fontFamily: Fonts.extrabold },
  cardWrap: { position: 'relative', paddingTop: Spacing.two },
  tape: { position: 'absolute', top: 0, alignSelf: 'center', width: 96, height: 22, backgroundColor: Colors.straw, opacity: 0.9, transform: [{ rotate: '2deg' }], zIndex: 2 },
  card: { borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, backgroundColor: Colors.paper, overflow: 'hidden', ...Shadows.offsetSmall },
  cardHeader: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, paddingHorizontal: Spacing.three, backgroundColor: Colors.ink },
  cardComuna: { fontFamily: Fonts.monoSemibold, fontSize: 11, lineHeight: 15, letterSpacing: 1, textTransform: 'uppercase' },
  cardWhen: { fontFamily: Fonts.mono, fontSize: 10.5, lineHeight: 14, letterSpacing: 1, textTransform: 'uppercase' },
  cardBody: { flexDirection: 'row', gap: Spacing.three, padding: Spacing.three },
  cardCopy: { flex: 1, minWidth: 0, gap: 3 },
  cardTitle: { fontFamily: Fonts.extrabold, fontSize: 16, lineHeight: 21 },
  cardText: { fontFamily: Fonts.regular, fontSize: 15, lineHeight: 21 },
  cardImage: { width: 100, height: 100, borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm },
  cardImageEmpty: { width: 100, height: 100, borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, backgroundColor: Colors.strawLight },
  shareLabel: { paddingTop: Spacing.one },
  shareRow: { flexDirection: 'row', gap: Spacing.two },
  shareButton: { flex: 1, minHeight: 82, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, backgroundColor: Colors.paper },
  shareButtonLabel: { fontFamily: Fonts.extrabold, fontSize: 13.5, lineHeight: 18 },
  muralBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three, backgroundColor: Colors.ink, paddingHorizontal: Spacing.five, paddingTop: Spacing.three },
  muralLabel: { fontFamily: Fonts.anton, fontSize: 32, lineHeight: 37, letterSpacing: 0.3, textTransform: 'uppercase', color: Colors.paper },
  pressed: { opacity: 0.7 },
});
