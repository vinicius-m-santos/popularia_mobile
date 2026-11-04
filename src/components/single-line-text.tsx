import { AppText, type AppTextProps } from './app-text';

/**
 * Texto de uma linha para nomes e rótulos que não podem quebrar o layout.
 * Sempre corta com reticências; o flexShrink permite encolher dentro de linhas.
 */
export function SingleLineText({ style, ...rest }: AppTextProps) {
  return <AppText {...rest} numberOfLines={1} ellipsizeMode="tail" style={[{ flexShrink: 1, minWidth: 0 }, style]} />;
}
