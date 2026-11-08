import { Image } from 'expo-image';
import { useState } from 'react';

import { useToast } from '@/components/toast';
import { publishMark } from '@/features/media/image-cache';
import { tryLockImageUpload, unlockImageUpload } from '@/features/media/image-lock';
import type { PickedImage } from '@/features/media/pick-image';
import { uploadMark } from '@/features/media/upload-image';
import { describeError } from '@/lib/errors';
import type { ComunaDetails } from '@/types/models';

/** Estado e envio da marca da comuna: prévia local, lock por comuna e erro com toast. */
export function useComunaMark(comuna: ComunaDetails, onChanged?: () => void) {
  const toast = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const shown = preview ?? comuna.markUrl ?? null;

  const send = async (image: PickedImage) => {
    const lock = `mark:${comuna.id}`;
    if (!tryLockImageUpload(lock)) return;
    setPreview(image.uri);
    setUploading(true);
    try {
      const url = await uploadMark(comuna.id, image);
      publishMark(comuna, url);
      try { await Image.prefetch(url); } catch { /* a marca local continua até a URL nova entrar */ }
      onChanged?.();
      setPreview(null);
    } catch (error) {
      setPreview(null);
      toast.show(describeError(error));
    } finally {
      setUploading(false);
      unlockImageUpload(lock);
    }
  };

  return { sheetOpen, setSheetOpen, shown, uploading, send };
}
