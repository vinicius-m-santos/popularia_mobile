import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Platform, Share } from 'react-native';
import { canonicalUrl, destinationHref, parsePopulariaUrl, PUBLIC_LINK_ORIGIN } from '../destinations';
import { shareDestination } from '../share';
import { redirectSystemPath } from '@/app/+native-intent';
import { peekIncomingDestination, receivePopulariaUrl, takeIncomingDestination } from '../incoming';
import { notificationHref } from '@/features/notifications/navigation';

jest.mock('@/constants/config', () => ({ API_BASE_URL: 'https://api-stg.popularia.com.br/api/v1' }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useSegments: () => [] }));
const id = '019abcde-0000-7000-8000-000000000001';
beforeEach(() => { takeIncomingDestination(); });
describe('destinos e URLs canônicas', () => {
  it.each([['post', 'p', id], ['profile', 'u', id], ['comuna', 'c', 'tarifa-zero'], ['document', 'd', id], ['event', 'e', id]] as const)('%s gera HTTPS e retorna ao mesmo destino', (kind, path, value) => {
    const target = { kind, id: value };
    expect(canonicalUrl(target)).toBe(`${PUBLIC_LINK_ORIGIN}/${path}/${value}`);
    expect(parsePopulariaUrl(canonicalUrl(target))).toEqual(target);
    expect(parsePopulariaUrl(`populariamobile://${path}/${value}`)).toEqual(target);
  });
  it.each(['garbage', 'https://evil.test/p/'+id, 'https://api.popularia.com.br/p/'+id, `${PUBLIC_LINK_ORIGIN}/x/${id}`, `${PUBLIC_LINK_ORIGIN}/p/invalid`, `${PUBLIC_LINK_ORIGIN}/u/me`, `${PUBLIC_LINK_ORIGIN}/c/a%2Fb`, `${PUBLIC_LINK_ORIGIN}/p/${id}?token=secret`, `${PUBLIC_LINK_ORIGIN}/p/${id}#fragment`, `${PUBLIC_LINK_ORIGIN}/p/%`, `${PUBLIC_LINK_ORIGIN}/d/${id}/extra`, 'https://user:pass@api-stg.popularia.com.br/p/'+id])('recusa link não suportado: %s', (url) => {
    expect(parsePopulariaUrl(url)).toBeNull();
  });
  it('aceita parâmetros de redes sociais sem repassá-los à rota ou ao share', () => {
    const target = parsePopulariaUrl(`${PUBLIC_LINK_ORIGIN}/p/${id}?utm_source=telegram&fbclid=tracking`);
    expect(target).toEqual({ kind: 'post', id });
    expect(canonicalUrl(target!)).toBe(`${PUBLIC_LINK_ORIGIN}/p/${id}`);
    expect(destinationHref(target!)).toBe(`/post/${id}`);
  });
  it('não compartilha IDs locais nem conteúdo desconhecido', () => {
    expect(() => canonicalUrl({ kind: 'post', id: 'mock-1' })).toThrow();
    expect(receivePopulariaUrl(`${PUBLIC_LINK_ORIGIN}/unknown/${id}`)).toBe(false);
    expect(peekIncomingDestination()).toBeNull();
  });
  it('push e links usam as mesmas rotas, preservando a pilha Avisos', () => {
    expect(notificationHref({ kind: 'post', id })).toBe(`/avisos/post/${id}`);
    expect(destinationHref({ kind: 'post', id })).toBe(`/post/${id}`);
    expect(notificationHref({ kind: 'profile', id })).toBe(`/avisos/pessoa/${id}`);
    expect(notificationHref({ kind: 'comuna', id: 'tarifa' })).toBe('/avisos/comuna/tarifa');
    expect(destinationHref({ kind: 'document', id })).toEqual({ pathname: '/biblioteca/documento/[id]', params: { id } });
    expect(destinationHref({ kind: 'event', id })).toEqual({ pathname: '/evento/[id]', params: { id } });
    expect(notificationHref({ kind: 'event', id })).toEqual({ pathname: '/evento/[id]', params: { id } });
    expect(notificationHref({ kind: 'square', id })).toEqual({ pathname: '/praca/[id]', params: { id } });
    expect(notificationHref({ kind: 'join_requests', id: 'tarifa' })).toEqual({ pathname: '/gerir-comuna/[id]', params: { id: 'tarifa', aba: 'pedidos' } });
  });
  it('native intent guarda o destino antes de Router/auth e substitui pela intenção mais recente', () => {
    expect(redirectSystemPath({ path: `${PUBLIC_LINK_ORIGIN}/p/${id}`, initial: true })).toBe('/abrir-link');
    expect(peekIncomingDestination()?.target).toEqual({ kind: 'post', id });
    redirectSystemPath({ path: `${PUBLIC_LINK_ORIGIN}/c/tarifa`, initial: false });
    expect(takeIncomingDestination()?.target).toEqual({ kind: 'comuna', id: 'tarifa' });
    expect(takeIncomingDestination()).toBeNull();
    expect(redirectSystemPath({ path: 'https://evil.test', initial: false })).toBe('/link-indisponivel');
    expect(redirectSystemPath({ path: '/conta', initial: true })).toBe('/conta');
  });
  it.each(['android', 'ios'] as const)('share %s tem contexto curto e URL, sem token', async (os) => {
    const previous = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
    const spy = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
    try {
      await shareDestination({ kind: 'post', id });
      expect(spy).toHaveBeenCalledWith(os === 'ios' ? { title: 'Veja esta publicação no Popularia', message: 'Veja esta publicação no Popularia', url: canonicalUrl({ kind: 'post', id }) } : { title: 'Veja esta publicação no Popularia', message: `Veja esta publicação no Popularia\n${canonicalUrl({ kind: 'post', id })}` });
    } finally { spy.mockRestore(); Object.defineProperty(Platform, 'OS', { configurable: true, value: previous }); }
  });
});
