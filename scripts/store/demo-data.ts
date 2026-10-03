// Demo content for the store screenshots (docs/play-store.md): realistic Budapest spots in English.
// Photos are free Pexels images (Pexels licence: free to use, no attribution required), downloaded at
// seed time; the ids are listed here so the set can be reproduced.

export const DEMO_PASSWORD = 'demo-password-123';

export const DEMO_USERS = {
  anna: { uid: 'demo-anna', email: 'anna@spoton.test', username: 'anna_explores' },
  mark: { uid: 'demo-mark', email: 'mark@spoton.test', username: 'mark_walks' },
  zsofi: { uid: 'demo-zsofi', email: 'zsofi@spoton.test', username: 'zsofi' },
  bence: { uid: 'demo-bence', email: 'bence@spoton.test', username: 'bence.k' },
} as const;

export type DemoUserKey = keyof typeof DEMO_USERS;

export interface DemoReview {
  by: DemoUserKey;
  rating: number;
  comment: string;
  daysAgo: number;
}

export interface DemoSpot {
  id: string;
  name: string;
  category: string;
  description: string;
  location: { lat: number; lng: number };
  owner: DemoUserKey;
  status: 'approved' | 'pending';
  daysAgo: number;
  /** Pexels photo ids, primary first. */
  photos: number[];
  reviews: DemoReview[];
}

export const DEMO_SPOTS: DemoSpot[] = [
  {
    id: 'demo-fishermans-bastion',
    name: "Fisherman's Bastion terrace",
    category: 'scenic',
    description: 'Come right after sunrise: the upper terrace is free then, and the whole of Pest glows across the river.',
    location: { lat: 47.5022, lng: 19.0347 },
    owner: 'anna',
    status: 'approved',
    daysAgo: 21,
    photos: [19913429, 18782261],
    reviews: [
      { by: 'mark', rating: 5, comment: 'Went at 6:30, had the towers to myself. Unreal light.', daysAgo: 12 },
      { by: 'zsofi', rating: 5, comment: 'Best view of the Parliament in the city.', daysAgo: 6 },
      { by: 'bence', rating: 4, comment: 'Busy by 10, so go early.', daysAgo: 2 },
    ],
  },
  {
    id: 'demo-parliament-golden-hour',
    name: 'Parliament at golden hour',
    category: 'viewpoint',
    description: 'The riverside steps at Batthyány tér face the Parliament head-on. Sunset turns the facade gold.',
    location: { lat: 47.5064, lng: 19.0386 },
    owner: 'mark',
    status: 'approved',
    daysAgo: 30,
    photos: [20234381],
    reviews: [
      { by: 'anna', rating: 5, comment: 'Sat here with a coffee until the lights came on.', daysAgo: 18 },
      { by: 'zsofi', rating: 4, comment: 'Lovely, a bit windy by the water.', daysAgo: 9 },
    ],
  },
  {
    id: 'demo-danube-night',
    name: 'Danube lights at night',
    category: 'part',
    description: 'A quiet spot on the Buda bank below the castle. The Chain Bridge and the Parliament light up around 8 pm.',
    location: { lat: 47.4990, lng: 19.0405 },
    owner: 'zsofi',
    status: 'approved',
    daysAgo: 14,
    photos: [20234383],
    reviews: [{ by: 'bence', rating: 5, comment: 'Bring a blanket, stay for an hour.', daysAgo: 4 }],
  },
  {
    id: 'demo-chain-bridge-walk',
    name: 'Walking the Chain Bridge',
    category: 'random',
    description: 'Freshly renovated and car-free on weekends. Walk it from Buda towards Pest for the best angle.',
    location: { lat: 47.4988, lng: 19.0436 },
    owner: 'anna',
    status: 'approved',
    daysAgo: 10,
    photos: [27410612, 8390036],
    reviews: [{ by: 'mark', rating: 4, comment: 'Great at dusk, the lions are photogenic.', daysAgo: 3 }],
  },
  {
    id: 'demo-parliament-gardens',
    name: 'Parliament dome through the trees',
    category: 'park',
    description: 'The small garden on the north side of Kossuth tér frames the dome between old plane trees.',
    location: { lat: 47.5082, lng: 19.0458 },
    owner: 'bence',
    status: 'approved',
    daysAgo: 8,
    photos: [20552900],
    reviews: [],
  },
  {
    id: 'demo-central-cafe',
    name: 'Central Café terrace',
    category: 'date-spot',
    description: 'A classic coffee house since 1887. Ask for a table outside in the evening.',
    location: { lat: 47.4914, lng: 19.0567 },
    owner: 'anna',
    status: 'approved',
    daysAgo: 5,
    photos: [32590883],
    reviews: [{ by: 'zsofi', rating: 5, comment: 'Perfect first-date place. The cakes are worth it.', daysAgo: 1 }],
  },
  {
    id: 'demo-chain-bridge-buda',
    name: 'Chain Bridge from the Buda bank',
    category: 'viewpoint',
    description: 'Stand at the end of the tram stop for the bridge, the Parliament and the river in one frame.',
    location: { lat: 47.4972, lng: 19.0392 },
    owner: 'mark',
    status: 'approved',
    daysAgo: 25,
    photos: [8390036],
    reviews: [],
  },
  // Anna's other spots (level on the profile): away from the city centre, no photos.
  ...[
    ['demo-normafa', 'Normafa sledding hill', 'hiking', 47.5047, 18.9636, 'approved'],
    ['demo-szentendre', 'Szentendre riverside steps', 'part', 47.6693, 19.0786, 'approved'],
    ['demo-visegrad', 'Visegrád citadel view', 'viewpoint', 47.7936, 18.9796, 'pending'],
    ['demo-pilis', 'Dobogókő ridge trail', 'hiking', 47.7196, 18.8985, 'pending'],
    ['demo-tihany', 'Tihany lavender field', 'scenic', 46.9139, 17.8894, 'pending'],
  ].map(([id, name, category, lat, lng, status], i): DemoSpot => ({
    id: id as string,
    name: name as string,
    category: category as string,
    description: 'Worth the trip out of the city.',
    location: { lat: lat as number, lng: lng as number },
    owner: 'anna',
    status: status as DemoSpot['status'],
    daysAgo: 40 + i * 7,
    photos: [],
    reviews: [],
  })),
];

export const PEXELS_URL = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1280`;
