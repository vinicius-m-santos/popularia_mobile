import { TabStack } from '@/components/tab-stack';

/** Garante que um link direto para comuna/discussão ainda tenha o feed para voltar. */
export const unstable_settings = { anchor: 'index' };

/** Pilha da aba Início: feed → comuna → discussão → perfil. */
export default TabStack;
