// Pure users/{uid} doc → store User mapping (T11a, BUG-02). Shared by every sign-in path.

export interface NotificationSettings {
  spotApproved: boolean; // Get notified when spot is approved
  spotReviewed: boolean; // Get notified when spot receives reviews or likes
  newPendingSpot: boolean; // Get notified for new pending spots (admins only)
}

export interface User {
  uid: string;
  username: string; // Only username, no separate display name
  email: string;
  photoURL?: string;
  profilePictureURL?: string;
  profileBannerURL?: string;
  savedSpots: string[];
  highlightedSpots?: string[]; // Array of spot IDs user highlighted (max based on level)
  customNameColor?: string; // Custom name color for level 5
  customNameFont?: string; // Custom font for level 5
  notificationSettings?: NotificationSettings;
  spotsCount?: number; // Server-maintained (T09), all statuses (D8)
}

export interface AuthInfo {
  email: string | null;
  photoURL: string | null;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function mapNotificationSettings(value: unknown): NotificationSettings | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const settings = value as Record<string, unknown>;
  const flag = (key: keyof NotificationSettings) =>
    typeof settings[key] === 'boolean' ? (settings[key] as boolean) : true;
  return {
    spotApproved: flag('spotApproved'),
    spotReviewed: flag('spotReviewed'),
    newPendingSpot: flag('newPendingSpot'),
  };
}

export function mapUserDoc(uid: string, authInfo: AuthInfo, data: Record<string, unknown>): User {
  const user: User = {
    uid,
    username: str(data.username) || 'user',
    email: authInfo.email || '',
    photoURL: authInfo.photoURL || str(data.photoURL) || '',
    profilePictureURL: str(data.profilePictureURL) || str(data.photoURL) || authInfo.photoURL || '',
    profileBannerURL: str(data.profileBannerURL) || '',
    savedSpots: stringArray(data.savedSpots),
    highlightedSpots: stringArray(data.highlightedSpots),
  };

  if (typeof data.customNameColor === 'string') user.customNameColor = data.customNameColor;
  if (typeof data.customNameFont === 'string') user.customNameFont = data.customNameFont;

  const notificationSettings = mapNotificationSettings(data.notificationSettings);
  if (notificationSettings) user.notificationSettings = notificationSettings;

  const spotsCount = data.spotsCount;
  if (typeof spotsCount === 'number' && Number.isInteger(spotsCount) && spotsCount >= 0) {
    user.spotsCount = spotsCount;
  }

  return user;
}
