/**
 * Menu "⋯" de publicações, comentários e perfis, com o fluxo de denúncia (design 2h):
 * menu → motivo → detalhes → confirmação. Um único provedor serve o app inteiro.
 */
import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { canonicalUrl } from '@/features/links/destinations';
import { shareDestination } from '@/features/links/share';
import * as Clipboard from 'expo-clipboard';

import { AppText } from '@/components/app-text';
import { BottomSheet, PopulariaBottomSheetTextInput } from '@/components/bottom-sheet';
import { CheckboxMark, RadioMark } from '@/components/choice-marks';
import { Icon, type IconName } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { useToast } from '@/components/toast';
import { DEMO_MODE } from '@/constants/config';
import { apiRequest } from '@/lib/api/client';
import { describeError } from '@/lib/errors';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useMe } from '@/features/account/account-context';
import { useInteractions } from '@/features/interactions/interactions-context';
import { findComuna } from '@/features/lookup';
import { openModeration, useNav } from '@/lib/routes';
import type { ReportTarget } from '@/types/models';

import { DETAILS_MAX_LENGTH, REPORT_REASONS } from './constants';
import { useModeration } from './moderation-context';

type Step = 'menu' | 'reason' | 'details' | 'done';

type ActionsSheetValue = {
  /** Abre o menu "⋯" do conteúdo. */
  open: (target: ReportTarget) => void;
};

const ActionsSheetContext = createContext<ActionsSheetValue | null>(null);

const TITLES: Record<ReportTarget['kind'], string> = {
  post: 'Denunciar publicação',
  comment: 'Denunciar comentário',
  profile: 'Denunciar perfil',
};

export function ActionsSheetProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<ReportTarget | null>(null);
  const [step, setStep] = useState<Step>('menu');
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [block, setBlock] = useState(false);
  const [result, setResult] = useState<{ protocol: string; inMyQueue: boolean } | null>(null);
  const [blockedHandles, setBlockedHandles] = useState<string[]>([]);

  const open = useCallback((next: ReportTarget) => {
    setTarget(next);
    setStep('menu');
    setReason('');
    setDetails('');
    setBlock(false);
    setResult(null);
  }, []);

  const close = useCallback(() => setTarget(null), []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <ActionsSheetContext value={value}>
      {children}
      <BottomSheet visible={target !== null} onClose={close}>
        {target ? (
          <SheetBody
            target={target}
            step={step}
            setStep={setStep}
            reason={reason}
            setReason={setReason}
            details={details}
            setDetails={setDetails}
            block={block}
            setBlock={setBlock}
            result={result}
            setResult={setResult}
            blocked={blockedHandles.includes(target.author.handle)}
            setBlocked={(handle, blocked) => setBlockedHandles((items) => blocked ? [...new Set([...items, handle])] : items.filter((item) => item !== handle))}
            close={close}
          />
        ) : null}
      </BottomSheet>
    </ActionsSheetContext>
  );
}

export function useActionsSheet(): ActionsSheetValue {
  const ctx = use(ActionsSheetContext);
  if (!ctx) throw new Error('useActionsSheet precisa estar dentro de <ActionsSheetProvider>.');
  return ctx;
}

type BodyProps = {
  target: ReportTarget;
  step: Step;
  setStep: (s: Step) => void;
  reason: string;
  setReason: (r: string) => void;
  details: string;
  setDetails: (d: string) => void;
  block: boolean;
  setBlock: (b: boolean) => void;
  result: { protocol: string; inMyQueue: boolean } | null;
  setResult: (r: { protocol: string; inMyQueue: boolean }) => void;
  blocked: boolean;
  setBlocked: (handle: string, blocked: boolean) => void;
  close: () => void;
};

function SheetBody(props: BodyProps) {
  const { target, step, setStep, reason, setReason, details, setDetails, block, setBlock, result, setResult, blocked, setBlocked, close } =
    props;
  const toast = useToast();
  const me = useMe();
  const nav = useNav();
  const { isOn, toggle, setOn } = useInteractions();
  const { submitReport } = useModeration();
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);

  const handle = target.author.handle;
  // Conteúdo da API traz a autoria decidida pelo servidor; nos mocks, compara com o ID local "me".
  const isMine = target.isOwn ?? target.author.id === me.id;
  const comuna = findComuna(target.comunaId);
  const comunaName = comuna ? `c/ ${comuna.name}` : 'Popularia';
  const title = TITLES[target.kind];

  if (step === 'menu') {
    const saved = isOn('savedPosts', target.id);
    const muted = isOn('mutedUsers', target.author.id);
    return (
      <View>
        {target.kind === 'post' ? (
          <MenuItem
            icon="bookmark"
            label={saved ? 'Remover dos salvos' : 'Salvar publicação'}
            onPress={() => {
              const on = toggle('savedPosts', target.id);
              close();
              toast.show(on ? 'Salvo neste aparelho até fechar o app.' : 'Removido dos salvos.');
            }}
          />
        ) : null}
        {!isMine ? (
          <MenuItem
            icon="mute"
            label={muted ? `Deixar de silenciar @${handle}` : `Silenciar @${handle}`}
            onPress={() => {
              const on = toggle('mutedUsers', target.author.id);
              close();
              toast.show(
                on
                  ? `@${handle} silenciado neste aparelho. As publicações somem do seu feed.`
                  : `@${handle} não está mais silenciado.`,
              );
            }}
          />
        ) : null}
        {target.kind !== 'comment' ? <>
          <MenuItem icon="shareNodes" label={target.kind === 'profile' ? 'Compartilhar perfil' : 'Compartilhar publicação'} onPress={async () => {
            try { await shareDestination({ kind: target.kind as 'post' | 'profile', id: target.id }); close(); }
            catch { toast.show('Não conseguimos compartilhar este conteúdo.'); }
          }} />
          <MenuItem icon="link" label="Copiar link" onPress={async () => {
            try { await Clipboard.setStringAsync(canonicalUrl({ kind: target.kind as 'post' | 'profile', id: target.id })); close(); toast.show('Link copiado.'); }
            catch { toast.show('Este conteúdo ainda não possui um link público.'); }
          }} />
        </> : null}
        {!isMine && !DEMO_MODE ? <MenuItem icon="mute" label={blocked ? `Desbloquear @${handle}` : `Bloquear @${handle}`} danger onPress={async () => {
          try {
            await apiRequest(`/me/blocks/${encodeURIComponent(handle)}`, { auth: true, method: blocked ? 'DELETE' : 'PUT' });
            setBlocked(handle, !blocked);
            setOn('mutedUsers', [target.author.id], !blocked);
            close();
            toast.show(blocked ? `@${handle} desbloqueado.` : 'Pessoa bloqueada no serviço.');
          }
          catch (e) { toast.show(describeError(e)); }
        }} /> : null}
        {!isMine ? (
          <MenuItem icon="flag" label={title} danger last onPress={() => setStep('reason')} />
        ) : null}
      </View>
    );
  }

  if (step === 'reason') {
    return (
      <View style={styles.stack}>
        <StepHeader label="Etapa 1 de 2" onClose={close} />
        <AppText style={styles.title} accessibilityRole="header">
          {title}
        </AppText>
        <AppText style={styles.lead} color={Colors.inkSoft}>
          Qual é o problema? Escolha o motivo principal.
        </AppText>
        <View>
          {REPORT_REASONS.map((r) => (
            <Pressable
              key={r}
              onPress={() => {
                setReason(r);
                setStep('details');
              }}
              role="radio"
              accessibilityState={{ checked: reason === r }}
              style={({ pressed }) => [styles.reason, pressed && styles.pressed]}>
              <RadioMark selected={reason === r} />
              <AppText style={styles.reasonLabel}>{r}</AppText>
              <Icon name="chevronRight" size={16} color={Colors.muted} />
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  if (step === 'details') {
    const submit = async () => {
      if (sending.current) return;
      sending.current = true; setBusy(true);
      try {
        const res = await submitReport({ target, reason, details });
        if (block) {
          if (!DEMO_MODE) await apiRequest(`/me/blocks/${encodeURIComponent(handle)}`, { auth: true, method: 'PUT' });
          setBlocked(handle, true);
          setOn('mutedUsers', [target.author.id], true);
        }
        setResult(res); setStep('done');
      } catch (e) { toast.show(describeError(e)); }
      finally { sending.current = false; setBusy(false); }
    };
    return (
      <View style={styles.stack}>
        <View style={styles.stepRow}>
          <Pressable
            onPress={() => setStep('reason')}
            accessibilityRole="button"
            accessibilityLabel="Voltar aos motivos. Etapa 2 de 2"
            style={styles.stepBack}>
            <Icon name="back" size={14} color={Colors.muted} />
            <AppText variant="label" color={Colors.muted} style={styles.stepLabel}>
              Etapa 2 de 2
            </AppText>
          </Pressable>
          <IconButton icon="close" size={18} accessibilityLabel="Fechar" onPress={close} style={styles.closeBtn} />
        </View>
        <AppText style={styles.title} accessibilityRole="header">
          {title}
        </AppText>
        <View style={styles.reasonChip}>
          <Icon name="flag" size={14} color={Colors.cream} />
          <AppText style={styles.reasonChipText} color={Colors.cream}>
            {reason}
          </AppText>
        </View>
        <View style={styles.field}>
          <AppText style={styles.fieldLabel}>
            Detalhes{' '}
            <AppText style={styles.fieldLabelSoft} color={Colors.muted}>
              (opcional)
            </AppText>
          </AppText>
          <PopulariaBottomSheetTextInput
            value={details}
            onChangeText={setDetails}
            maxLength={DETAILS_MAX_LENGTH}
            multiline
            textAlignVertical="top"
            placeholder="Conte o que aconteceu, se quiser. Isso ajuda a moderação a decidir."
            placeholderTextColor={Colors.placeholder}
            accessibilityLabel="Detalhes da denúncia, opcional"
            style={styles.textarea}
          />
        </View>
        <Pressable
          onPress={() => setBlock(!block)}
          role="checkbox"
          accessibilityState={{ checked: block }}
          style={styles.check}>
          <CheckboxMark checked={block} />
          <AppText style={styles.checkLabel}>Bloquear @{handle} também</AppText>
        </Pressable>
        <AppText style={styles.note} color={Colors.muted}>
          A denúncia vai para a moderação de {comunaName}. Quem publicou não sabe quem denunciou.
        </AppText>
        <DarkButton label={busy ? "Enviando…" : "Enviar denúncia"} onPress={submit} />
      </View>
    );
  }

  return (
    <View style={styles.done} accessibilityLiveRegion="polite">
      <View style={styles.doneIcon}>
        <Icon name="check" size={32} color={Colors.cream} />
      </View>
      <AppText style={styles.doneTitle} accessibilityRole="header">
        Denúncia registrada
      </AppText>
      <AppText style={styles.doneText} color={Colors.inkSoft}>
        {!DEMO_MODE ? 'Denúncia enviada à equipe do Popularia. Para acompanhamento, informe o identificador abaixo ao suporte.' : result?.inMyQueue
          ? `Você modera ${comunaName}, então ela já está na sua fila de moderação.`
          : `Nesta versão a denúncia fica só neste aparelho. Com o servidor, a moderação de ${comunaName} analisa em até 24 horas e você recebe um aviso com a decisão.`}
        {block ? ` @${handle} foi bloqueado${DEMO_MODE ? ' neste aparelho' : ' no serviço'}.` : ''}
      </AppText>
      <AppText style={styles.protocol} color={Colors.muted}>
        Protocolo {result?.protocol} · {reason}
      </AppText>
      <DarkButton label="Entendi" onPress={close} stretch />
      {result?.inMyQueue && comuna ? (
        <TextLink
          label="Abrir fila de moderação"
          onPress={() => {
            close();
            openModeration(comuna.id);
          }}
        />
      ) : null}
      {comuna ? (
        <TextLink
          label="Ver regras da comuna"
          onPress={() => {
            close();
            nav.openComuna(comuna.id, 'regras');
          }}
        />
      ) : null}
    </View>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  danger = false,
  last = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  const color = danger ? Colors.red : Colors.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.menuItem, !last && styles.menuDivider, pressed && styles.pressed]}>
      <Icon name={icon} size={21} color={color} />
      <AppText style={[styles.menuLabel, danger && styles.menuDanger]} color={color}>
        {label}
      </AppText>
    </Pressable>
  );
}

function StepHeader({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <View style={styles.stepRow}>
      <AppText variant="label" color={Colors.muted} style={styles.stepLabel}>
        {label}
      </AppText>
      <IconButton icon="close" size={18} accessibilityLabel="Fechar" onPress={onClose} style={styles.closeBtn} />
    </View>
  );
}

/** Botão principal escuro das folhas de denúncia e moderação. */
export function DarkButton({ label, onPress, stretch = false }: { label: string; onPress: () => void; stretch?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.dark, stretch && styles.darkStretch, pressed && styles.pressed]}>
      <AppText style={styles.darkLabel} color={Colors.cream}>
        {label}
      </AppText>
    </Pressable>
  );
}

function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.link}>
      <AppText style={styles.linkLabel} color={Colors.red}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  menuItem: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  menuDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2D6C1',
  },
  menuLabel: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    lineHeight: 21,
  },
  menuDanger: {
    fontFamily: Fonts.extrabold,
  },
  stack: {
    gap: Spacing.three,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepBack: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  stepLabel: {
    fontSize: 10.5,
  },
  closeBtn: {
    marginRight: -10,
  },
  title: {
    fontFamily: Fonts.condensed,
    fontSize: 32,
    lineHeight: 32,
    textTransform: 'uppercase',
  },
  lead: {
    fontSize: 14.5,
    lineHeight: 20,
  },
  reason: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: '#E2D6C1',
  },
  reasonLabel: {
    flex: 1,
    fontFamily: Fonts.bold,
    fontSize: 15.5,
    lineHeight: 20,
  },
  reasonChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: Colors.ink,
  },
  reasonChipText: {
    fontFamily: Fonts.bold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: Fonts.bold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  fieldLabelSoft: {
    fontFamily: Fonts.regular,
    fontSize: 13.5,
  },
  textarea: {
    minHeight: 96,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    backgroundColor: Colors.cream,
    paddingHorizontal: 14,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    fontFamily: Fonts.regular,
    fontSize: 15.5,
    lineHeight: 21,
    color: Colors.ink,
    outlineWidth: 0,
  },
  check: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  checkLabel: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  note: {
    fontSize: 13,
    lineHeight: 18,
  },
  dark: {
    height: 54,
    borderRadius: Radius.pill,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
  },
  darkStretch: {
    alignSelf: 'stretch',
    marginTop: 6,
  },
  darkLabel: {
    fontFamily: Fonts.condensed,
    fontSize: 20,
    lineHeight: 23,
    textTransform: 'uppercase',
  },
  done: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.one,
  },
  doneIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: {
    fontFamily: Fonts.condensed,
    fontSize: 34,
    lineHeight: 34,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  doneText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  protocol: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.6,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  link: {
    minHeight: 40,
    justifyContent: 'center',
  },
  linkLabel: {
    fontFamily: Fonts.extrabold,
    fontSize: 14,
    lineHeight: 18,
  },
});
