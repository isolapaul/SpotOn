import { create } from 'zustand';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  onSnapshot,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import imageCompression from 'browser-image-compression';

export interface Spot {
  id: string;
  name: string;
  category: 'scenic' | 'smoke-spot' | 'viewpoint' | 'other';
  description: string;
  imageUrl: string;
  location: {
    lat: number;
    lng: number;
  };
  createdBy: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
}

interface SpotStore {
  spots: Spot[];
  isLoading: boolean;
  error: string | null;
  fetchSpots: () => void;
  addSpot: (spotData: Omit<Spot, 'id' | 'imageUrl' | 'createdAt' | 'status'>, imageFile: File, userId: string) => Promise<void>;
}

export const useSpotStore = create<SpotStore>((set) => ({
  spots: [],
  isLoading: false,
  error: null,

  fetchSpots: () => {
    try {
      const spotsRef = collection(db, 'spots');
      // Fetch only approved spots for public view
      const q = query(
        spotsRef, 
        where('status', '==', 'approved'),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const spotsList: Spot[] = [];
        snapshot.forEach((doc) => {
          spotsList.push({ id: doc.id, ...doc.data() } as Spot);
        });
        set({ spots: spotsList, isLoading: false, error: null });
      }, (error) => {
        console.error('Error fetching spots:', error);
        set({ error: error.message, isLoading: false });
      });

      // Store unsubscribe function if needed
      return unsubscribe;
    } catch (error: any) {
      console.error('Error setting up spots listener:', error);
      set({ error: error.message, isLoading: false });
    }
  },

  addSpot: async (spotData, imageFile, userId) => {
    try {
      set({ isLoading: true, error: null });

      // Step 1: Compress the image
      console.log('Original file size:', imageFile.size / 1024 / 1024, 'MB');
      
      const options = {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
      };

      const compressedFile = await imageCompression(imageFile, options);
      console.log('Compressed file size:', compressedFile.size / 1024 / 1024, 'MB');

      // Step 2: Upload compressed image to Firebase Storage
      const timestamp = Date.now();
      const fileName = `${timestamp}_${imageFile.name}`;
      const imageRef = ref(storage, `spot-images/${fileName}`);
      
      await uploadBytes(imageRef, compressedFile);
      const imageUrl = await getDownloadURL(imageRef);

      // Step 3: Add spot document to Firestore
      const spotDoc = {
        ...spotData,
        imageUrl,
        createdBy: userId,
        status: 'pending', // CRITICAL: All new spots start as pending
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'spots'), spotDoc);
      
      set({ isLoading: false });
      console.log('Spot added successfully!');
    } catch (error: any) {
      console.error('Error adding spot:', error);
      set({ error: error.message, isLoading: false });
      throw error; // Re-throw so the UI can handle it
    }
  },
}));
