import type { TopicId } from '@/types/models';

export type LibraryScope = 'public' | 'personal' | 'comuna' | 'saved';
export type DocumentAccess = 'private' | 'followers' | 'visitors' | 'members' | 'moderators';
export type Origin = { kind: 'personal' | 'comuna'; id: string; name: string; slug?: string };
export type LibraryDocument = {
  id: string;
  state: 'available' | 'locked' | 'unavailable';
  title: string | null;
  description: string | null;
  origin: Origin | null;
  collection: { id: string; name: string } | null;
  responsible: { id: string; name: string; handle: string } | null;
  createdAt: string | null;
  byteSize: number | null;
  pageCount: number | null;
  topic: TopicId | null;
  access: DocumentAccess | null;
  isPublic: boolean | null;
  saved: boolean;
  viewer: { canEdit?: boolean; canDelete?: boolean; canPublicize?: boolean; canShare?: boolean; canRemove?: boolean };
  distributions: { slug: string; name: string; visibility: 'public' | 'private' }[] | null;
  message: string | null;
};
export type LibraryCollection = { id: string; name: string; description: string; origin: Origin; documentCount: number; canManage: boolean; canAdd: boolean };
export type LibraryFilters = { scope: LibraryScope; owner?: string; comuna?: string; q?: string; topic?: string; origin?: 'all' | 'people' | 'comunas'; sort?: 'recent' | 'relevance'; collection?: string };
export type DocumentMetadata = { title: string; description: string; collectionId: string; access: DocumentAccess; topic: TopicId | null; isPublic: boolean; sharedWith?: string[]; clientId?: string; clearTopic?: boolean };
export type PickedPdf = { uri: string; name: string; mimeType?: string; size?: number; file?: File };
