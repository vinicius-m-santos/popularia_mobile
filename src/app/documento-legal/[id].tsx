import { useLocalSearchParams } from 'expo-router';
import { LegalDocumentPage } from '@/features/legal/legal-document-screen';

export default function LegalDocumentRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LegalDocumentPage id={id} />;
}
