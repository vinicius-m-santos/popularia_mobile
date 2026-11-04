import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';

import { KeyboardAwareScrollView, useKeyboardAwareFieldFocus } from '@/components/keyboard-aware-scroll-view';
import { AppText } from '@/components/app-text';
import { EditorialAction } from '@/components/editorial-action';
import { EditorialHeader } from '@/components/editorial-header';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { useToast } from '@/components/toast';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { getPost, updatePost } from '@/features/posts/api';
import type { FeedItem } from '@/types/models';
import { describeError } from '@/lib/errors';
import { queryClient } from '@/lib/query/client';

export default function EditPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const focusField = useKeyboardAwareFieldFocus();
  const [post, setPost] = useState<FeedItem | null>(null);
  const [body, setBody] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getPost(id).then((value) => {
      if (!active) return;
      setPost(value);
      setBody(value.text);
      setTitle(value.title ?? '');
    }, (cause: unknown) => { if (active) setError(describeError(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const canSave = !saving && (body.trim().length > 0 || title.trim().length > 0);

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      await updatePost(id, { body: body.trim(), title: title.trim() || null });
      await queryClient.invalidateQueries();
      await router.back();
      toast.show('Publicação atualizada.');
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      <EditorialHeader title="Editar publicação" onBack={() => router.back()} backLabel="Voltar" />
      {loading ? <StateView kind="loading" message="Carregando publicação" /> : !post ? (
        <StateView kind="error" message={error || 'Não conseguimos carregar esta publicação.'} onRetry={() => router.replace({ pathname: '/editar-publicacao/[id]', params: { id } })} />
      ) : (
        <KeyboardAwareScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.field}>
            <AppText variant="label">Título</AppText>
            <TextInput value={title} onChangeText={setTitle} onFocus={focusField ?? undefined} maxLength={120} placeholder="Ex.: Quinta tem ato contra o aumento da passagem" placeholderTextColor={Colors.placeholder} accessibilityLabel="Título da publicação" style={styles.titleInput} />
          </View>
          <View style={styles.field}>
            <AppText variant="label">Texto</AppText>
            <TextInput value={body} onChangeText={setBody} onFocus={focusField ?? undefined} multiline maxLength={1000} placeholder="Escreva sua publicação" placeholderTextColor={Colors.placeholder} accessibilityLabel="Texto da publicação" textAlignVertical="top" style={styles.bodyInput} />
          </View>
          {error ? <AppText color={Colors.red} accessibilityLiveRegion="polite">{error}</AppText> : null}
          {saving ? <ActivityIndicator color={Colors.red} accessibilityLabel="Salvando publicação" /> : (
            <EditorialAction label="Salvar alterações" icon="check" tone="red" labelVariant="button" disabled={!canSave} onPress={() => { void save(); }} style={styles.save} />
          )}
        </KeyboardAwareScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.five, gap: Spacing.four, maxWidth: 640, width: '100%', alignSelf: 'center' },
  field: { gap: Spacing.two },
  titleInput: { minHeight: 48, borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, backgroundColor: Colors.paper, paddingHorizontal: Spacing.three, fontFamily: Fonts.bold, fontSize: 17, lineHeight: 25, color: Colors.ink },
  bodyInput: { minHeight: 180, borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, backgroundColor: Colors.paper, padding: Spacing.three, fontFamily: Fonts.regular, fontSize: 16, lineHeight: 23, color: Colors.ink },
  save: { marginTop: Spacing.two },
});
