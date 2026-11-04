import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ReportSuccessSheet } from '@/features/moderation/report-success-sheet';
import type { ReportTarget } from '@/types/models';

const target: ReportTarget = {
  kind: 'post',
  id: 'post-1',
  author: { id: 'u1', name: 'Vinicius Santos', handle: 'u01a1', initials: 'VS', tone: 'red' },
  comunaId: 'devs',
  comunaName: 'Devs do Brasil',
  excerpt: 'Qual livro vamos ler no próximo encontro?',
  title: 'Qual livro vamos ler no próximo encontro?',
  poll: true,
  where: 'Publicação',
};

async function renderSheet(patch: Partial<ReportTarget> = {}, props: Partial<Parameters<typeof ReportSuccessSheet>[0]> = {}) {
  const onBlock = jest.fn();
  const onUndo = jest.fn();
  const onClose = jest.fn();
  const onOpenRules = jest.fn();
  const view = await render(
    <ReportSuccessSheet
      target={{ ...target, ...patch }}
      canBlock
      blockedBefore={false}
      blockedNow={false}
      busy={false}
      onBlock={onBlock}
      onUndo={onUndo}
      onClose={onClose}
      onOpenRules={onOpenRules}
      {...props}
    />,
  );
  return { view, onBlock, onUndo, onClose, onOpenRules };
}

describe('confirmação da denúncia', () => {
  it('mostra o título, o cartão da enquete e o que acontece agora', async () => {
    await renderSheet();
    expect(screen.getByRole('header', { name: 'DENÚNCIA ENVIADA.' })).toBeTruthy();
    expect(screen.getByText('ENQUETE')).toBeTruthy();
    expect(screen.getByText('Qual livro vamos ler no próximo encontro?')).toBeTruthy();
    expect(screen.getByText('c/ Devs do Brasil')).toBeTruthy();
    expect(screen.getByText('01')).toBeTruthy();
    expect(screen.getByText('A pessoa não fica sabendo quem denunciou.')).toBeTruthy();
    expect(screen.getByText('02')).toBeTruthy();
    expect(screen.getByText('Se o conteúdo quebrar as regras, ele sai do ar.')).toBeTruthy();
  });

  it('usa o nome da pessoa, não o @ gerado, na ação de bloqueio', async () => {
    const { onBlock } = await renderSheet();
    expect(screen.getByText('Bloquear Vinicius Santos')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Bloquear Vinicius Santos' }));
    expect(onBlock).toHaveBeenCalledTimes(1);
  });

  it('cai para o @ quando a pessoa não tem nome', async () => {
    await renderSheet({ author: { ...target.author, name: '' } });
    expect(screen.getByText('Bloquear @u01a1')).toBeTruthy();
  });

  it('a linha vira o estado bloqueado e oferece Desfazer', async () => {
    const { onUndo } = await renderSheet({}, { blockedNow: true });
    expect(screen.getByText('Vinicius Santos foi bloqueado')).toBeTruthy();
    expect(screen.getByText('Dá pra desfazer em Conta › Bloqueios')).toBeTruthy();
    expect(screen.queryByText('Bloquear Vinicius Santos')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Desfazer bloqueio de Vinicius Santos' }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('esconde a ação quando a pessoa já estava bloqueada', async () => {
    await renderSheet({}, { blockedBefore: true });
    expect(screen.queryByText('Bloquear Vinicius Santos')).toBeNull();
  });

  it('não oferece bloqueio para uma comuna', async () => {
    await renderSheet({ kind: 'comuna', title: 'Devs do Brasil' }, { canBlock: false });
    expect(screen.queryByText('Bloquear Devs do Brasil')).toBeNull();
  });

  it('abre as Regras da Comunidade e fecha pelo Entendi', async () => {
    const { onOpenRules, onClose } = await renderSheet();
    await fireEvent.press(screen.getByRole('link', { name: 'Abrir as Regras da Comunidade' }));
    expect(onOpenRules).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Entendi' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('usa o @ para perfil sem nome e não repete a comuna no perfil', async () => {
    await renderSheet({ kind: 'profile', title: 'Ana', comunaId: null, comunaName: undefined, author: { ...target.author, name: 'Ana', handle: 'ana' } });
    expect(screen.getByText('PERFIL')).toBeTruthy();
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByText('@ana')).toBeTruthy();
  });
});
