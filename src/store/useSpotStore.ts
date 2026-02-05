import { create } from 'zustand';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  onSnapshot,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  arrayUnion,
  Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import imageCompression from 'browser-image-compression';

export interface Review {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  rating: number;
  comment: string;
  createdAt: Timestamp;
}

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
  createdByName?: string;
  createdByPhoto?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
  reviews?: Review[];
  averageRating?: number;
}

interface SpotStore {
  spots: Spot[];
  isLoading: boolean;
  error: string | null;
  fetchSpots: () => void;
  addSpot: (spotData: Omit<Spot, 'id' | 'imageUrl' | 'createdAt' | 'status'>, imageFile: File | null, userId: string) => Promise<void>;
  addReview: (spotId: string, review: Omit<Review, 'id' | 'createdAt'>) => Promise<void>;
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

      console.log('=== Starting addSpot ===');
      console.log('Spot data:', spotData);
      console.log('User ID:', userId);
      console.log('Has image:', !!imageFile);

      let imageUrl = '';

      // Only compress and upload if image is provided
      if (imageFile) {
        // Step 1: Compress the image
        console.log('Step 1: Compressing image...');
        console.log('Original file size:', imageFile.size / 1024 / 1024, 'MB');
        
        const options = {
          maxSizeMB: 0.3,
          maxWidthOrHeight: 1280,
          useWebWorker: true,
        };

        const compressedFile = await imageCompression(imageFile, options);
        console.log('Compressed file size:', compressedFile.size / 1024 / 1024, 'MB');
        console.log('Step 1 complete ✓');

        // Step 2: Upload compressed image to Firebase Storage
        console.log('Step 2: Uploading to Firebase Storage...');
        const timestamp = Date.now();
        const fileName = `${timestamp}_${imageFile.name}`;
        const imageRef = ref(storage, `spot-images/${fileName}`);
        console.log('Storage path:', `spot-images/${fileName}`);
        
        await uploadBytes(imageRef, compressedFile);
        console.log('Upload complete, getting download URL...');
        imageUrl = await getDownloadURL(imageRef);
        console.log('Image URL:', imageUrl);
        console.log('Step 2 complete ✓');
      } else {
        console.log('No image provided, using placeholder');
        imageUrl = '/placeholder-spot.jpg'; // Placeholder image
      }

      // Step 3: Add spot document to Firestore
      console.log('Step 3: Adding to Firestore...');
      const spotDoc = {
        ...spotData,
        imageUrl,
        createdBy: userId,
        status: 'pending', // CRITICAL: All new spots start as pending
        createdAt: serverTimestamp(),
      };
      console.log('Spot document:', spotDoc);

      const docRef = await addDoc(collection(db, 'spots'), spotDoc);
      console.log('Document added with ID:', docRef.id);
      console.log('Step 3 complete ✓');
      
      set({ isLoading: false });
      console.log('=== Spot added successfully! ===');
    } catch (error: any) {
      console.error('=== ERROR in addSpot ===');
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);
      console.error('Full error:', error);
      set({ error: error.message, isLoading: false });
      throw error; // Re-throw so the UI can handle it
    }
  },

  addReview: async (spotId, review) => {
    try {
      const spotRef = doc(db, 'spots', spotId);
      const reviewWithTimestamp = {
        ...review,
        id: `${review.userId}_${Date.now()}`,
        createdAt: Timestamp.now(),
      };

      await updateDoc(spotRef, {
        reviews: arrayUnion(reviewWithTimestamp),
      });

      // Update local state
      set((state) => ({
        spots: state.spots.map((spot) => {
          if (spot.id === spotId) {
            const updatedReviews = [...(spot.reviews || []), reviewWithTimestamp];
            const avgRating = updatedReviews.reduce((acc, r) => acc + r.rating, 0) / updatedReviews.length;
            return { 
              ...spot, 
              reviews: updatedReviews,
              averageRating: avgRating
            };
          }
          return spot;
        }),
      }));
    } catch (error: any) {
      console.error('Error adding review:', error);
      throw error;
    }
  },
}));
