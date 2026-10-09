/** Native: one app instance, no tab coordination needed. */
export type TabStatus = 'owner' | 'elsewhere' | 'no-storage';

export async function claimTab(): Promise<TabStatus> {
  return 'owner';
}

export async function takeOverTab(): Promise<void> {
  // Nothing to do on native.
}
