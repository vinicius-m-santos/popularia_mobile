import { router } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { BottomSheet } from '@/components/bottom-sheet';
import { Icon, type IconName } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { useToast } from '@/components/toast';
import { DEMO_MODE } from '@/constants/config';
import { Colors, Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAccount, useMe } from '@/features/account/account-context';
import { getComunas, getMyComunas } from '@/features/comunas/api';
import { ComunaMark } from '@/features/comunas/components/comuna-mark';
import { useInteractions } from '@/features/interactions/interactions-context';
import { createPost } from '@/features/posts/api';
import { PostCard } from '@/features/posts/components/post-card';
import { useAsyncData } from '@/hooks/use-async-data';
import { ApiError, describeError } from '@/lib/errors';
import { formatPeople } from '@/lib/format';
import type { Comuna, FeedItem } from '@/types/models';

const MAX_LENGTH = 1000;
/** Seguidores do perfil de demonstração, para "Visível para…". */
const MY_FOLLOWERS = 312;

/** Destino da publicação: o próprio perfil ou uma comuna de que a pessoa participa. */
type Destination = { kind: 'perfil' } | { kind: 'comuna'; comuna: Comuna };

/** Texto para as recusas conhecidas de POST /posts. */
function publishErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.type === '/errors/not-a-member') return 'Entre na comuna para publicar nela.';
    if (error.violations.body) return error.violations.body;
    if (error.violations.comunaId) return error.violations.comunaId;
  }
  return `Não foi possível publicar. ${describeError(error)}`;
}

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/**
 * Criar publicação (design 2f). Com a API, publica de verdade (só em comunas de que a pessoa
 * participa ou no próprio perfil); no modo demonstração, guarda só neste aparelho.
 */
export default function CreatePostScreen() {
  const me = useMe();
  const { account, reloadAccount } = useAccount();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { membershipOf, addPost, notifyPostCreated } = useInteractions();
  // Na API, só as comunas de que a pessoa participa, segundo o servidor.
  const loadComunas = useCallback(() => (DEMO_MODE ? getComunas() : getMyComunas()), []);
  const comunas = useAsyncData(loadComunas);

  const [text, setText] = useState('');
  const [preview, setPreview] = useState(false);
  const [picking, setPicking] = useState(false);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const needsVerification = !DEMO_MODE && account !== null && !account.emailVerified;

  const joined = useMemo(
    () => (comunas.data ?? []).filter((c) => membershipOf(c.id) ?? c.viewerIsMember ?? false),
    [comunas.data, membershipOf],
  );

  // Se a escolha deixou de valer (saiu da comuna), cai para a primeira comuna ou o perfil.
  const destination: Destination = useMemo(() => {
    if (chosenId === 'perfil') return { kind: 'perfil' };
    const comuna = joined.find((c) => c.id === chosenId) ?? joined[0];
    return comuna ? { kind: 'comuna', comuna } : { kind: 'perfil' };
  }, [chosenId, joined]);

  const trimmed = text.trim();
  const canPublish = trimmed.length > 0 && !publishing;
  const where = destination.kind === 'perfil' ? 'seu perfil' : `c/ ${destination.comuna.name}`;

  const close = () => {
    if (publishing) return;
    if (!trimmed) return leave();
    Alert.alert('Descartar publicação?', 'O texto que você escreveu será perdido.', [
      { text: 'Continuar escrevendo', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: leave },
    ]);
  };

  const askToVerify = () =>
    Alert.alert(
      'Confirme seu e-mail',
      'Para publicar, confirme o e-mail da sua conta com o código que enviamos. Seu texto continua aqui.',
      [
        { text: 'Agora não', style: 'cancel' },
        { text: 'Confirmar e-mail', onPress: () => router.push('/verificar-email') },
      ],
    );

  const publish = async () => {
    if (publishing) return;
    if (!trimmed) {
      toast.show('Escreva algo antes de publicar.');
      return;
    }
    const comunaId = destination.kind === 'comuna' ? destination.comuna.id : null;

    if (DEMO_MODE) {
      addPost({ comunaId, text: trimmed });
      toast.show(`Publicado em ${where} só neste aparelho. Nada foi enviado.`);
      leave();
      if (comunaId) router.push({ pathname: '/comuna/[id]', params: { id: comunaId } });
      else router.navigate('/perfil');
      return;
    }

    if (needsVerification) return askToVerify();
    // Comunas da API sempre trazem o UUID; sem ele, nunca cair para "publicar no perfil" por engano.
    const comunaServerId = destination.kind === 'comuna' ? destination.comuna.serverId : null;
    if (comunaServerId === undefined) {
      toast.show('Não foi possível identificar a comuna. Escolha o destino de novo.');
      return;
    }
    setPublishing(true);
    try {
      await createPost({ comunaServerId, text: trimmed });
    } catch (error) {
      setPublishing(false);
      if (error instanceof ApiError && error.type === '/errors/email-not-verified') {
        // A conta no aparelho estava desatualizada: recarrega para os avisos ficarem certos.
        reloadAccount().catch(() => {});
        return askToVerify();
      }
      toast.show(publishErrorMessage(error));
      return;
    }
    notifyPostCreated();
    toast.show(`Publicado em ${where}.`);
    leave();
    // Publicações no perfil aparecem no feed "Para você" (o perfil próprio ainda é fictício).
    if (comunaId) router.push({ pathname: '/comuna/[id]', params: { id: comunaId } });
    else router.navigate('/');
  };

  const soon = (what: string) => () => toast.show(`${what} chega numa próxima etapa.`);

  const previewItem: FeedItem = {
    id: 'preview',
    authorId: me.id,
    comunaId: destination.kind === 'comuna' ? destination.comuna.id : null,
    createdAt: new Date().toISOString(),
    text: trimmed || 'Seu texto aparece aqui.',
    supportCount: 0,
    commentCount: 0,
    echoCount: 0,
    author: me,
    comuna: destination.kind === 'comuna' ? destination.comuna : null,
    event: null,
    topCommentAuthor: null,
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <View style={styles.bar}>
          <IconButton icon="close" size={20} accessibilityLabel="Fechar" onPress={close} />
          <AppText style={styles.barTitle} accessibilityRole="header" numberOfLines={1}>
            Nova publicação
          </AppText>
          <Pressable
            onPress={publish}
            disabled={publishing}
            accessibilityRole="button"
            accessibilityLabel={publishing ? 'Publicando' : 'Publicar'}
            accessibilityState={{ disabled: !canPublish, busy: publishing }}
            accessibilityHint={canPublish ? `Publica em ${where}` : 'Escreva algo para publicar'}
            style={({ pressed }) => [
              styles.publish,
              !canPublish && !publishing && styles.publishIdle,
              (pressed || publishing) && styles.pressed,
            ]}>
            {publishing ? (
              <ActivityIndicator color={Colors.paper} />
            ) : (
              <AppText style={styles.publishLabel} color={canPublish ? Colors.paper : Colors.muted}>
                Publicar
              </AppText>
            )}
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          {needsVerification ? (
            <Pressable
              onPress={() => router.push('/verificar-email')}
              accessibilityRole="button"
              accessibilityHint="Abre a confirmação de e-mail"
              style={({ pressed }) => [styles.verify, pressed && styles.pressed]}>
              <AppText style={styles.verifyText} color={Colors.ink}>
                Confirme seu e-mail para publicar. Você pode escrever agora e publicar depois de confirmar.{' '}
                <AppText style={[styles.verifyText, styles.verifyLink]} color={Colors.red}>
                  Confirmar e-mail
                </AppText>
              </AppText>
            </Pressable>
          ) : null}
          <View>
            <AppText variant="label" color={Colors.muted} style={styles.fieldLabel}>
              Publicar em
            </AppText>
            <Pressable
              onPress={() => setPicking(true)}
              accessibilityRole="button"
              accessibilityLabel={`Publicar em ${where}. Trocar destino`}
              style={({ pressed }) => [styles.dest, pressed && styles.pressed]}>
              <DestinationMark destination={destination} me={me} />
              <View style={styles.destText}>
                <AppText style={styles.destName} numberOfLines={1}>
                  {destination.kind === 'perfil' ? 'Meu perfil' : `c/ ${destination.comuna.name}`}
                </AppText>
                <AppText style={styles.destSub} color={Colors.muted} numberOfLines={1}>
                  {destination.kind === 'perfil'
                    ? DEMO_MODE
                      ? `Visível para seus ${MY_FOLLOWERS} seguidores`
                      : 'Visível no seu perfil e no feed'
                    : `Visível para ${formatPeople(destination.comuna.memberCount)} membros da comuna`}
                </AppText>
              </View>
              <AppText style={styles.change} color={Colors.red}>
                Trocar
              </AppText>
            </Pressable>
          </View>

          <View style={styles.segment} role="tablist">
            <Segment label="Escrever" active={!preview} onPress={() => setPreview(false)} />
            <Segment label="Pré-visualizar" active={preview} onPress={() => setPreview(true)} />
          </View>

          {preview ? (
            <View style={styles.previewWrap}>
              <AppText variant="label" color={Colors.muted} style={styles.previewLabel}>
                Assim vai aparecer em {where}
              </AppText>
              <View
                style={styles.previewBox}
                pointerEvents="none"
                accessible
                accessibilityLabel={`Pré-visualização: ${previewItem.text}`}
                importantForAccessibility="no-hide-descendants">
                <PostCard item={previewItem} />
              </View>
            </View>
          ) : (
            <View>
              <View style={styles.writeRow}>
                <Avatar initials={me.initials} tone={me.tone} size={36} />
                <TextInput
                  value={text}
                  onChangeText={setText}
                  maxLength={MAX_LENGTH}
                  multiline
                  autoFocus
                  textAlignVertical="top"
                  placeholder="Conte para a comuna o que está acontecendo…"
                  placeholderTextColor={Colors.placeholder}
                  accessibilityLabel="Texto da publicação"
                  style={styles.input}
                />
              </View>
              <AppText style={styles.counter} color={text.length >= MAX_LENGTH ? Colors.red : Colors.muted}>
                {text.length}/{MAX_LENGTH}
              </AppText>
            </View>
          )}
        </ScrollView>

        <View style={[styles.toolbar, { paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
          <ToolButton icon="image" label="Imagem" onPress={soon('Anexar imagens')} />
          <ToolButton icon="calendar" label="Chamado" onPress={soon('Criar chamado')} />
          <ToolButton icon="poll" label="Enquete" onPress={soon('Criar enquete')} />
        </View>
      </KeyboardAvoidingView>

      <BottomSheet visible={picking} onClose={() => setPicking(false)} title="Publicar em">
        <DestinationOption
          selected={destination.kind === 'perfil'}
          mark={<Avatar initials={me.initials} tone={me.tone} size={42} />}
          name="Meu perfil"
          subtitle={DEMO_MODE ? `${MY_FOLLOWERS} seguidores` : 'Visível no seu perfil e no feed'}
          onPress={() => {
            setChosenId('perfil');
            setPicking(false);
          }}
        />
        {joined.map((c) => (
          <DestinationOption
            key={c.id}
            selected={destination.kind === 'comuna' && destination.comuna.id === c.id}
            mark={<ComunaMark initials={c.initials} tone={c.tone} size={42} />}
            name={`c/ ${c.name}`}
            subtitle={`${formatPeople(c.memberCount)} membros`}
            onPress={() => {
              setChosenId(c.id);
              setPicking(false);
            }}
          />
        ))}
        {comunas.status === 'loading' ? (
          <AppText variant="caption" style={styles.sheetNote}>
            Carregando suas comunas…
          </AppText>
        ) : null}
        {comunas.status === 'error' ? (
          <Pressable onPress={comunas.reload} accessibilityRole="button" style={styles.sheetNote}>
            <AppText variant="caption">
              Não foi possível carregar suas comunas. <AppText style={styles.findMoreLabel} color={Colors.red}>Tentar de novo</AppText>
            </AppText>
          </Pressable>
        ) : null}
        {comunas.status === 'success' && joined.length === 0 ? (
          <AppText variant="caption" style={styles.sheetNote}>
            Você ainda não participa de nenhuma comuna. Entre em uma pelo Explorar para publicar nela.
          </AppText>
        ) : null}
        <Pressable
          onPress={() => {
            setPicking(false);
            if (router.canGoBack()) router.back();
            router.navigate('/explorar');
          }}
          accessibilityRole="button"
          accessibilityHint="Fecha a publicação e abre o Explorar"
          style={styles.findMore}>
          <AppText style={styles.findMoreLabel} color={Colors.red}>
            Procurar outras comunas
          </AppText>
        </Pressable>
      </BottomSheet>
    </Screen>
  );
}

function DestinationMark({ destination, me }: { destination: Destination; me: FeedItem['author'] }) {
  if (destination.kind === 'perfil') return <Avatar initials={me.initials} tone={me.tone} size={44} />;
  const { comuna } = destination;
  return <ComunaMark initials={comuna.initials} tone={comuna.tone} size={44} />;
}

function Segment({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      role="tab"
      accessibilityState={{ selected: active }}
      hitSlop={{ top: 5, bottom: 5 }}
      style={[styles.segmentItem, active && styles.segmentActive]}>
      <AppText style={styles.segmentLabel} color={active ? Colors.cream : Colors.ink}>
        {label}
      </AppText>
    </Pressable>
  );
}

function ToolButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint="Ainda não disponível"
      style={({ pressed }) => [styles.tool, pressed && styles.pressed]}>
      <Icon name={icon} size={21} />
      <AppText style={styles.toolLabel}>{label}</AppText>
    </Pressable>
  );
}

type OptionProps = {
  selected: boolean;
  mark: ReactNode;
  name: string;
  subtitle: string;
  onPress: () => void;
};

function DestinationOption({ selected, mark, name, subtitle, onPress }: OptionProps) {
  return (
    <Pressable
      onPress={onPress}
      role="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${name}, ${subtitle}`}
      style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
      {mark}
      <View style={styles.optionText}>
        <AppText style={styles.optionName} numberOfLines={1}>
          {name}
        </AppText>
        <AppText style={styles.destSub} color={Colors.muted}>
          {subtitle}
        </AppText>
      </View>
      {selected ? <Icon name="check" size={20} color={Colors.red} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  bar: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 6,
    paddingRight: Spacing.two + 2,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.ink,
    backgroundColor: Colors.cream,
  },
  barTitle: {
    flex: 1,
    fontFamily: Fonts.condensed,
    fontSize: 23,
    lineHeight: 26,
    textTransform: 'uppercase',
  },
  publish: {
    height: 42,
    paddingHorizontal: Spacing.five,
    borderRadius: Radius.pill,
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verify: {
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.red,
    backgroundColor: Colors.paper,
  },
  verifyText: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  verifyLink: {
    fontFamily: Fonts.extrabold,
  },
  publishIdle: {
    backgroundColor: Colors.straw,
  },
  publishLabel: {
    fontFamily: Fonts.condensed,
    fontSize: 17,
    lineHeight: 20,
    textTransform: 'uppercase',
  },
  pressed: {
    opacity: 0.75,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingTop: 14,
    paddingHorizontal: Spacing.five,
    paddingBottom: Spacing.six,
    gap: 14,
  },
  fieldLabel: {
    fontSize: 10.5,
    marginBottom: 6,
  },
  dest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 14,
    backgroundColor: Colors.paper,
  },
  destText: {
    flex: 1,
    minWidth: 0,
  },
  destName: {
    fontFamily: Fonts.extrabold,
    fontSize: 16,
    lineHeight: 21,
  },
  destSub: {
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 1,
  },
  change: {
    fontFamily: Fonts.extrabold,
    fontSize: 13,
    lineHeight: 17,
  },
  segment: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.one,
    padding: 3,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    borderRadius: Radius.pill,
  },
  segmentItem: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: Colors.ink,
  },
  segmentLabel: {
    fontFamily: Fonts.bold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  writeRow: {
    flexDirection: 'row',
    gap: Spacing.two + 2,
  },
  input: {
    flex: 1,
    minHeight: 180,
    paddingTop: 6,
    paddingBottom: 0,
    fontFamily: Fonts.regular,
    fontSize: 18,
    lineHeight: 26,
    color: Colors.ink,
    outlineWidth: 0,
  },
  counter: {
    textAlign: 'right',
    fontFamily: Fonts.mono,
    fontSize: 11,
    lineHeight: 14,
  },
  previewWrap: {
    gap: Spacing.two,
  },
  previewLabel: {
    fontSize: 10.5,
  },
  previewBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.ink,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: Colors.cream,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderTopWidth: 1.5,
    borderTopColor: Colors.ink,
    backgroundColor: Colors.paper,
  },
  tool: {
    height: 48,
    paddingHorizontal: Spacing.two + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolLabel: {
    fontFamily: Fonts.bold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  option: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: '#E2D6C1',
  },
  optionText: {
    flex: 1,
    minWidth: 0,
  },
  optionName: {
    fontFamily: Fonts.bold,
    fontSize: 15.5,
    lineHeight: 20,
  },
  sheetNote: {
    paddingVertical: Spacing.three,
  },
  findMore: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  findMoreLabel: {
    fontFamily: Fonts.extrabold,
    fontSize: 14,
    lineHeight: 18,
  },
});
