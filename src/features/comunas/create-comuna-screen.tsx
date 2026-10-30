import { router, usePreventRemove } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { KeyboardView } from '@/components/keyboard-view';
import { RadioMark } from '@/components/choice-marks';
import { IconButton } from '@/components/icon-button';
import { PillButton } from '@/components/pill-button';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { DEMO_MODE } from '@/constants/config';
import { Colors, Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAccount } from '@/features/account/account-context';
import { useAsyncData } from '@/hooks/use-async-data';
import type { ComunaQuotaDto, ComunaNameAvailabilityDto } from '@/lib/api/dto';
import { SingleTopicField } from '@/features/onboarding/components/single-topic-field';
import type { TopicId } from '@/types/models';
import { ApiError } from '@/lib/errors';

import { checkComunaName, createComuna, getComunaQuota, type ComunaRuleInput } from './api';
import { cleanRules, RulesEditor, rulesViolation } from './components/rules-editor';
import { comunaErrorMessage } from './errors';

const NAME_MIN = 3;
const NAME_MAX = 60;
const DESCRIPTION_MAX = 500;
const PLACE_MAX = 80;

type Visibility = 'public' | 'private';

const VISIBILITY_OPTIONS: { key: Visibility; title: string; text: string }[] = [
  { key: 'public', title: 'Pública', text: 'Qualquer pessoa lê e entra. Só membros publicam e comentam.' },
  {
    key: 'private',
    title: 'Privada',
    text: 'Só membros leem. A entrada depende de pedido aprovado por você ou pela moderação.',
  },
];

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** Explica, antes do formulário, por que a criação seria recusada agora (segundo o servidor). */
function quotaBlock(quota: ComunaQuotaDto): { title: string; text: string; verify?: boolean } | null {
  switch (quota.blockedBy) {
    case null:
      return null;
    case '/errors/email-not-verified':
      return { title: 'Confirme seu e-mail', text: 'Para criar uma comuna, confirme o e-mail da sua conta.', verify: true };
    case '/errors/comuna-limit-reached':
      return {
        title: `Você já tem ${quota.limit} comunas ativas`,
        text: 'É o limite por pessoa. Arquive uma comuna ou transfira a propriedade dela para liberar uma vaga.',
      };
    default:
      return { title: 'Não é possível criar agora', text: 'Sua conta não pode criar comunas no momento.' };
  }
}

/**
 * Criar comuna (só com a API). Quem cria vira proprietário. Limite de comunas ativas,
 * e-mail confirmado e nome único são conferidos no servidor; o app
 * só antecipa as explicações (GET /me/comuna-quota e a prévia do nome).
 */
export default function CreateComunaScreen() {
  const toast = useToast();
  const { reloadAccount } = useAccount();
  const loadQuota = useCallback(() => getComunaQuota(), []);
  const quota = useAsyncData(loadQuota);

  const [topic, setTopic] = useState<TopicId | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [place, setPlace] = useState('');
  const [rules, setRules] = useState<ComunaRuleInput[]>([{ title: '', body: '' }]);
  const [checked, setChecked] = useState<{ name: string; result: ComunaNameAvailabilityDto } | null>(null);
  const [violations, setViolations] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [leaving, setLeaving] = useState(false);

  const trimmedName = name.trim().replace(/\s+/g, ' ');
  // A prévia só vale para o nome que está no campo agora.
  const availability = checked?.name === trimmedName ? checked.result : null;
  const dirty = !!(topic || trimmedName || description.trim() || place.trim() || visibility !== 'public' || rules.some((r) => r.title.trim() || r.body.trim()));
  const disablePrevention = usePreventRemove(!leaving && (submitting || dirty), ({ repeat }) => {
    if (submittingRef.current) return;
    Alert.alert('Descartar comuna?', 'O que você preencheu será perdido.', [
      { text: 'Continuar editando', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: () => { setLeaving(true); repeat(); } },
    ]);
  });

  // Prévia do endereço e da disponibilidade do nome, meio segundo depois de parar de digitar.
  useEffect(() => {
    if (DEMO_MODE || trimmedName.length < NAME_MIN) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      checkComunaName(trimmedName).then(
        (result) => {
          if (!cancelled) setChecked({ name: trimmedName, result });
        },
        () => {
          // Sem a prévia, o servidor confere o nome ao criar.
        },
      );
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedName]);

  const close = () => {
    if (submittingRef.current) return;
    leave();
  };

  const submit = async () => {
    if (submittingRef.current) return;
    const local: Record<string, string> = {};
    if (trimmedName.length < NAME_MIN) local.name = `Use pelo menos ${NAME_MIN} caracteres.`;
    if (!topic) local.topic = 'Escolha o assunto principal da comuna.';
    if (!description.trim()) local.description = 'Conte em poucas palavras para que serve a comuna.';
    setViolations(local);
    if (Object.keys(local).length > 0) return;

    submittingRef.current = true;
    setSubmitting(true);
    let created;
    try {
      created = await createComuna({
        name: trimmedName,
        description: description.trim(),
        visibility,
        topic: topic!,
        rules: cleanRules(rules),
        place: place.trim(),
      });
    } catch (error) {
      submittingRef.current = false;
      setSubmitting(false);
      if (error instanceof ApiError && error.status === 422) {
        setViolations(error.violations);
        return;
      }
      if (error instanceof ApiError && error.type === '/errors/email-not-verified') reloadAccount().catch(() => {});
      quota.reload();
      toast.show(comunaErrorMessage(error));
      return;
    }
    toast.show(`Comuna c/${created.handle} criada. Você é a pessoa proprietária.`);
    setLeaving(true);
    disablePrevention();
    router.dismissTo({ pathname: '/comuna/[id]', params: { id: created.id } });
  };

  const bar = (
    <View style={styles.bar}>
      <IconButton icon="back" size={20} accessibilityLabel="Voltar" onPress={close} />
      <AppText style={styles.barTitle} accessibilityRole="header" numberOfLines={1}>
        Nova comuna
      </AppText>
      {!DEMO_MODE && quota.data?.canCreate ? (
        <Pressable
          onPress={submit}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel={submitting ? 'Criando comuna' : 'Criar comuna'}
          accessibilityState={{ busy: submitting }}
          style={({ pressed }) => [styles.create, (pressed || submitting) && styles.pressed]}>
          {submitting ? (
            <ActivityIndicator color={Colors.paper} />
          ) : (
            <AppText style={styles.createLabel} color={Colors.paper}>
              Criar
            </AppText>
          )}
        </Pressable>
      ) : null}
    </View>
  );

  if (DEMO_MODE) {
    return (
      <Screen edges={['top', 'left', 'right', 'bottom']}>
        {bar}
        <StateView
          kind="empty"
          title="Disponível com o servidor"
          message="No modo demonstração nada é guardado. Configure EXPO_PUBLIC_API_URL para criar comunas de verdade."
        />
      </Screen>
    );
  }

  if (!quota.data) {
    return (
      <Screen edges={['top', 'left', 'right', 'bottom']}>
        {bar}
        {quota.status === 'error' ? (
          <StateView kind="error" message={`Não conseguimos verificar sua conta. ${comunaErrorMessage(quota.error)}`} onRetry={quota.reload} />
        ) : (
          <StateView kind="loading" message="Verificando sua conta" />
        )}
      </Screen>
    );
  }

  const blocked = quotaBlock(quota.data);
  if (blocked) {
    return (
      <Screen edges={['top', 'left', 'right', 'bottom']}>
        {bar}
        <View style={styles.blocked}>
          <StateView kind="empty" title={blocked.title} message={blocked.text} />
          {blocked.verify ? (
            <PillButton label="Confirmar e-mail" onPress={() => router.push('/verificar-email')} variant="outline" />
          ) : null}
        </View>
      </Screen>
    );
  }

  const nameHint =
    violations.name ??
    (availability
      ? availability.available
        ? `Endereço: c/${availability.slug} · disponível`
        : (availability.message ?? 'Esse nome não está disponível.')
      : 'O nome não poderá ser alterado depois.');
  const nameHintColor = violations.name || (availability && !availability.available) ? Colors.red : Colors.muted;

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardView style={styles.flex}>
        {bar}
        <ScrollView contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <AppText variant="caption">
            Você será a pessoa proprietária: edita descrição, assunto e regras, escolhe a moderação e decide sobre a comuna.
            Cada pessoa pode ter até {quota.data.limit} comunas ativas ({quota.data.activeOwned} em uso).
          </AppText>

          <TextField
            label="Nome"
            labelAside={`${name.length}/${NAME_MAX}`}
            value={name}
            onChangeText={setName}
            maxLength={NAME_MAX}
            placeholder="Ex.: Hortas da Zona Leste"
            hint={nameHint}
            hintColor={nameHintColor}
            autoCapitalize="words"
          />

          <TextField
            label="Descrição"
            labelAside={`${description.length}/${DESCRIPTION_MAX}`}
            value={description}
            onChangeText={setDescription}
            maxLength={DESCRIPTION_MAX}
            multiline
            placeholder="Para que serve a comuna e quem ela reúne"
            hint={violations.description}
            hintColor={Colors.red}
          />

          <SingleTopicField value={topic} onChange={setTopic} error={violations.topic ?? violations.topics} disabled={submitting} />

          <View style={styles.section} role="radiogroup" accessibilityLabel="Visibilidade">
            <AppText style={styles.sectionLabel}>Visibilidade</AppText>
            {VISIBILITY_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                onPress={() => setVisibility(opt.key)}
                role="radio"
                accessibilityState={{ checked: visibility === opt.key }}
                accessibilityLabel={`${opt.title}. ${opt.text}`}
                style={({ pressed }) => [styles.option, visibility === opt.key && styles.optionOn, pressed && styles.pressed]}>
                <RadioMark selected={visibility === opt.key} />
                <View style={styles.optionText}>
                  <AppText variant="bodyStrong">{opt.title}</AppText>
                  <AppText variant="caption">{opt.text}</AppText>
                </View>
              </Pressable>
            ))}
            <AppText variant="caption">A visibilidade não muda depois da criação.</AppText>
          </View>

          <TextField
            label="Lugar"
            labelAside="opcional"
            value={place}
            onChangeText={setPlace}
            maxLength={PLACE_MAX}
            placeholder="Ex.: São Paulo · SP"
            hint={violations.place}
            hintColor={Colors.red}
          />

          <View style={styles.section}>
            <AppText style={styles.sectionLabel}>Regras da comunidade</AppText>
            <RulesEditor rules={rules} onChange={setRules} error={rulesViolation(violations)} />
          </View>
        </ScrollView>
      </KeyboardView>
    </Screen>
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
  create: {
    height: 42,
    paddingHorizontal: Spacing.five,
    borderRadius: Radius.sm,
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createLabel: {
    fontFamily: Fonts.condensed,
    fontSize: 17,
    lineHeight: 20,
    textTransform: 'uppercase',
  },
  pressed: {
    opacity: 0.75,
  },
  blocked: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: Spacing.seven,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.five,
    paddingBottom: Spacing.eight,
    gap: Spacing.five,
  },
  section: {
    gap: Spacing.two,
  },
  sectionLabel: {
    fontFamily: Fonts.bold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1.5,
    borderColor: Colors.rule,
    borderRadius: Radius.xl,
    backgroundColor: Colors.paper,
  },
  optionOn: {
    borderColor: Colors.ink,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
});
