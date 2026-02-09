export interface Spot {
  id: string;
  lat: number;
  lng: number;
  name: string;
  description: string;
  imageUrls: string[]; // Array of image URLs (max 15)
  primaryImageIndex?: number; // Index of the primary image to display
  category: 'scenic' | 'smoke-spot' | 'viewpoint' | 'other' | 'part';
  createdBy: string;
  status: 'pending' | 'approved';
  createdAt: Date;
  reviews: Review[];
  isHighlighted?: boolean; // True if the spot is highlighted by its creator (level 3+)
  customIcon?: string; // Custom emoji icon for level 4+ users
}

export interface Review {
  userId: string;
  userName: string;
  userEmail: string;
  userPhoto?: string;
  rating: number;
  comment?: string;
  createdAt: Date;
  userSpotsCount?: number; // Number of spots user had when creating review (for level color)
  customNameColor?: string; // Custom name color if user is level 5
  customNameFont?: string; // Custom name font if user is level 5
}

export interface User {
  uid: string;
  username: string; // Only username, no separate display name
  email: string;
  profilePictureURL?: string;
  profileBannerURL?: string;
  savedSpots: string[];
  createdAt: Date;
  // Level System
  highlightedSpots?: string[]; // Array of spot IDs that user highlighted (max 1 for level 3, max 2 for level 4+)
  customNameColor?: string; // Custom name color for level 5 users
  customNameFont?: string; // Custom font style for level 5 users (font-family class name)
  // Notification Settings
  notificationSettings?: {
    spotApproved: boolean; // Get notified when spot is approved
    spotReviewed: boolean; // Get notified when spot receives reviews or likes
    newPendingSpot: boolean; // Get notified for new pending spots (admins only)
  };
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}
