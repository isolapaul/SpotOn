import { beforeEach, describe, expect, it } from 'vitest';
import { usePushPromptStore } from './usePushPromptStore';

const store = () => usePushPromptStore.getState();

describe('usePushPromptStore', () => {
  beforeEach(() => usePushPromptStore.setState({ answered: false, requested: false }));

  it('a contribution requests the offer once it is not answered yet', () => {
    store().request();
    expect(store().requested).toBe(true);
  });

  it('answering hides it and later contributions no longer request it', () => {
    store().request();
    store().answer();
    expect(store()).toMatchObject({ answered: true, requested: false });
    store().request();
    expect(store().requested).toBe(false);
  });
});
