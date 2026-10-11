import { isNativeApp } from '@/lib/nativeApp';
import { useToastStore } from '@/store/useToastStore';

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/**
 * Shares a link: the system share sheet (native in the apps: Android's WebView has no
 * navigator.share), else the clipboard with `copiedText` as the notice.
 */
export async function shareLink(
  { title, text, url }: { title: string; text?: string; url: string },
  copiedText: string,
): Promise<ShareOutcome> {
  if (isNativeApp()) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title, text, url });
      return 'shared';
    } catch (error) {
      // Closing the share sheet rejects too: nothing more to do then.
      if (error instanceof Error && /cancel/i.test(error.message)) return 'cancelled';
    }
  }
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    useToastStore.getState().showToast(copiedText, 'success');
    return 'copied';
  } catch {
    useToastStore.getState().showToast(url, 'info');
    return 'failed';
  }
}
