export interface Spot {
  id: string;
  lat: number;
  lng: number;
  name: string;
  description: string;
  imageUrl: string;
  category: 'scenic' | 'smoke-spot' | 'viewpoint' | 'other';
  createdBy: string;
  status: 'pending' | 'approved';
  createdAt: Date;
  reviews: Review[];
}

export interface Review {
  userId: string;
  userName: string;
  rating: number;
  comment?: string;
  createdAt: Date;
}

export interface User {
  uid: string;
  name: string;
  email: string;
  savedSpots: string[];
  createdAt: Date;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}
