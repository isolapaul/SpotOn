// Pure users/{uid} doc → store User mapping (T11a, BUG-02). Shared by every sign-in path.

export interface NotificationSettings {
  spotApproved: boolean; // Get notified when spot is approved
  spotReviewed: boolean; // Get notified when spot receives reviews or likes
  newPendingSpot: boolean; // Get notified for new pending spots (admins only)
  follows: boolean; // Follow requests, accepted requests, new spots from followed users (item 8)
}

export interface User {
  uid: string;
  username: string; // Only username, no separate display name
  /** The doc has no username (shown as "user"): account deletion then asks for the e-mail, as the server does. */
  usernameMissing?: true;
  email: string;
  photoURL?: string;
  profilePictureURL?: string;
  profileBannerURL?: string;
  savedSpots: string[];
  highlightedSpots?: string[]; // Array of spot IDs user highlighted (max based on level)
  customNameColor?: string; // Custom name color for level 5
  customNameFont?: string; // Custom font for level 5
  pinIcon?: string; // Special pin icon from level 4 (item 6); normalise before use
  notificationSettings?: NotificationSettings;
  spotsCount?: number; // Server-maintained (T09), all statuses (D8)
  termsVersion?: string; // The accepted Terms / Privacy Policy version (A1, lib/terms)
  bio?: string; // Item 8: up to BIO_MAX characters
  profilePrivate?: boolean; // Item 8: only accepted followers see the profile's lists
  showSaved?: boolean; // Item 8: saved spots shown on the profile (default hidden)
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
    follows: flag('follows'),
  };
}

export function mapUserDoc(uid: string, authInfo: AuthInfo, data: Record<string, unknown>): User {
  const user: User = {
    uid,
    username: str(data.username) || 'user',
    ...(str(data.username) ? {} : { usernameMissing: true as const }),
    email: authInfo.email || '',
    photoURL: authInfo.photoURL || str(data.photoURL) || '',
    profilePictureURL: str(data.profilePictureURL) || str(data.photoURL) || authInfo.photoURL || '',
    profileBannerURL: str(data.profileBannerURL) || '',
    savedSpots: stringArray(data.savedSpots),
    highlightedSpots: stringArray(data.highlightedSpots),
  };

  if (typeof data.customNameColor === 'string') user.customNameColor = data.customNameColor;
  if (typeof data.customNameFont === 'string') user.customNameFont = data.customNameFont;
  if (typeof data.pinIcon === 'string') user.pinIcon = data.pinIcon;

  const notificationSettings = mapNotificationSettings(data.notificationSettings);
  if (notificationSettings) user.notificationSettings = notificationSettings;

  if (typeof data.termsVersion === 'string') user.termsVersion = data.termsVersion;
  if (typeof data.bio === 'string' && data.bio) user.bio = data.bio;
  if (data.profilePrivate === true) user.profilePrivate = true;
  if (data.showSaved === true) user.showSaved = true;

  const spotsCount = data.spotsCount;
  if (typeof spotsCount === 'number' && Number.isInteger(spotsCount) && spotsCount >= 0) {
    user.spotsCount = spotsCount;
  }

  return user;
}
