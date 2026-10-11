// The app's own native plugin (SpotOnNative, mobile/ios/App/App/SpotOnNativePlugin.swift): Live
// Activities in the Dynamic Island and on the lock screen while an upload runs, and the home-screen
// quick actions. iOS only for now; every call is a no-op elsewhere and never throws.
import type { PluginListenerHandle } from '@capacitor/core';
import { nativePlatform } from '@/lib/nativeApp';

export type ActivityPhase = 'uploading' | 'done' | 'failed';

export interface ActivityState {
  phase: ActivityPhase;
  /** 0–1, or -1 when unknown. */
  progress: number;
  /** The localized status line ("Uploading photos…", "Your spot is up"). */
  status: string;
}

export interface QuickAction {
  type: string;
  title: string;
  /** An SF Symbol name. */
  icon: string;
}

interface SpotOnNativePlugin {
  startActivity(options: { id: string; title: string; kind: string } & ActivityState): Promise<{ started: boolean }>;
  updateActivity(options: { id: string } & ActivityState): Promise<void>;
  endActivity(options: { id: string; dismissAfter: number } & ActivityState): Promise<void>;
  setQuickActions(options: { items: QuickAction[] }): Promise<void>;
  takePendingQuickAction(): Promise<{ type?: string }>;
  addListener(event: 'quickAction', handler: (data: { type: string }) => void): Promise<PluginListenerHandle>;
}

let plugin: Promise<SpotOnNativePlugin> | null = null;

function native(): Promise<SpotOnNativePlugin> | null {
  if (nativePlatform() !== 'ios') return null;
  plugin ??= import('@capacitor/core').then(({ registerPlugin }) => registerPlugin<SpotOnNativePlugin>('SpotOnNative'));
  return plugin;
}

async function call<T>(run: (p: SpotOnNativePlugin) => Promise<T>): Promise<T | undefined> {
  const p = native();
  if (!p) return undefined;
  try {
    return await run(await p);
  } catch (error) {
    console.warn('SpotOnNative call failed:', error);
    return undefined;
  }
}

export const startActivity = (id: string, title: string, kind: string, state: ActivityState) =>
  call((p) => p.startActivity({ id, title, kind, ...state }));
export const updateActivity = (id: string, state: ActivityState) => call((p) => p.updateActivity({ id, ...state }));
/** Ends the activity; it stays visible `dismissAfter` seconds with its final state. */
export const endActivity = (id: string, state: ActivityState, dismissAfter: number) =>
  call((p) => p.endActivity({ id, dismissAfter, ...state }));
export const setQuickActions = (items: QuickAction[]) => call((p) => p.setQuickActions({ items }));

/** The quick action that launched the app (once), then every later one. */
export async function listenQuickActions(handler: (type: string) => void): Promise<() => void> {
  const p = native();
  if (!p) return () => {};
  try {
    const plugin = await p;
    const handle = await plugin.addListener('quickAction', ({ type }) => handler(type));
    const pending = await plugin.takePendingQuickAction();
    if (pending.type) handler(pending.type);
    return () => void handle.remove();
  } catch (error) {
    console.warn('Quick actions unavailable:', error);
    return () => {};
  }
}
