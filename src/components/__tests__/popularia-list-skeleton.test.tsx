import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import {
  ComunaScreenSkeleton,
  DiscussionScreenSkeleton,
  PopulariaListSkeleton,
  ProfileScreenSkeleton,
} from '@/components/list/popularia-list-skeleton';

describe('skeletons contextuais', () => {
  it('anuncia um único estado de carregamento e esconde os blocos decorativos', async () => {
    await render(<PopulariaListSkeleton rows={2} label="Carregando publicações" />);

    const loading = screen.getByRole('progressbar', { name: 'Carregando publicações' });
    expect(loading.props.accessibilityState).toEqual({ busy: true });
    expect(screen.getByTestId('popularia-skeleton-post')).toBeTruthy();
  });

  it('mantém formatos próprios para aviso, comentário e mídia', async () => {
    const view = await render(
      <>
        <PopulariaListSkeleton rows={2} variant="notification" />
        <PopulariaListSkeleton rows={1} variant="comment" />
        <PopulariaListSkeleton variant="media" />
      </>,
    );

    expect(screen.getByLabelText('Carregando avisos')).toBeTruthy();
    expect(screen.getByLabelText('Carregando comentários')).toBeTruthy();
    expect(screen.getByLabelText('Carregando mídia')).toBeTruthy();
    expect(screen.getByTestId('popularia-skeleton-notification')).toBeTruthy();
    expect(screen.getByTestId('popularia-skeleton-comment')).toBeTruthy();
    expect(screen.getByTestId('popularia-skeleton-media')).toBeTruthy();
    await view.unmount();
  });

  it('reserva a silhueta de comuna, perfil e discussão sem spinner', async () => {
    const view = await render(
      <>
        <ComunaScreenSkeleton />
        <ProfileScreenSkeleton />
        <DiscussionScreenSkeleton />
      </>,
    );

    expect(screen.getByLabelText('Carregando comuna')).toBeTruthy();
    expect(screen.getByLabelText('Carregando perfil')).toBeTruthy();
    expect(screen.getByLabelText('Carregando discussão')).toBeTruthy();
    expect(screen.getByTestId('comuna-skeleton')).toBeTruthy();
    expect(screen.getByTestId('profile-skeleton')).toBeTruthy();
    expect(screen.getByTestId('discussion-skeleton')).toBeTruthy();
    // O indicador genérico de spinner não participa mais deste primeiro quadro.
    expect(screen.queryByLabelText('Carregando conteúdo')).toBeNull();
    await view.unmount();
  });
});
