export type UserRole = 'student' | 'provider' | 'admin';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole | null;
  phone?: string;
  createdAt: any;
  language: 'en' | 'mr' | 'hi';
  theme: 'dark' | 'light';
  banned: boolean;
}

export type ListingCategory =
  | 'pg'
  | 'hostel'
  | 'flat'
  | 'mess'
  | 'shop'
  | 'hotel'
  | 'block'
  | 'doctor'
  | 'requirement'
  | 'secondhand'
  | 'advertisement';

export type ServiceType = ListingCategory | 'blockrent' | 'avashyakta' | 'newopening';
export type ListingPlanType = 'monthly' | 'perPost' | 'ad';

export interface ProviderProfile {
  uid: string;
  businessName: string;
  ownerName: string;
  phone: string;
  whatsapp: string;
  serviceType: ServiceType;
  subscriptionStart: any;
  subscriptionEnd: any;
  isActive: boolean;
  isFreeTrialUsed: boolean;
  extraItemCount: number;
  totalMonthlyCharge: number;
  createdAt: any;
  
  // Admin & Payment Management
  status: 'active' | 'inactive' | 'suspended';
  paymentStatus: 'paid' | 'pending';
  planType: 'free' | 'basic' | 'featured';
  paymentDate?: any;
  expiryDate?: any;
}

export interface Listing {
  id: string;
  providerId?: string;
  category: ListingCategory;
  name: string;
  description: string;
  area: string;
  nearCollege?: string;
  address?: string;
  landmark?: string;
  mapsLink?: string;
  location?: {
    lat: number;
    lng: number;
  };
  phone: string;
  whatsapp?: string;
  photos?: string[];
  active: boolean;
  createdAt: any;
  validUntil: any;
  totalViews: number;
  avgRating: number;
  totalRatings: number;
  pricePlan: number;
  duration?: number;
  planType?: ListingPlanType;
  isFeatured: boolean;
  priorityScore: number;
  isSponsored?: boolean;

  // Special Food Features (Mess/Hotel)
  specialOccasionOffer?: string;
  unlimitedAvailable?: boolean;
  unlimitedPrice?: number;
  weeklyMenu?: {
    monday?: string;
    tuesday?: string;
    wednesday?: string;
    thursday?: string;
    friday?: string;
    saturday?: string;
    sunday?: string;
    Monday?: string;
    Tuesday?: string;
    Wednesday?: string;
    Thursday?: string;
    Friday?: string;
    Saturday?: string;
    Sunday?: string;
  };
  
  // Block Rent specific
  blockType?: string;
  blockSize?: string;
  rentOrSell?: 'rent' | 'sell' | 'both';
  pricePerMonth?: number;
  sellingPrice?: number;
  amenities?: string[];
  
  // Requirement specific
  requirementType?: string;
  requirementText?: string;
  budget?: number;
  urgency?: string;
  
  // Second hand specific
  itemName?: string;
  condition?: 'new' | 'good' | 'used';
  price?: number;

  // Advertisement specific
  title?: string;
  bannerImage?: string;

  // Doctor specific
  doctorName?: string;
  specialization?: string;
  timing?: string;
  daysAvailable?: string;
  closedToday?: boolean;
  closedTill?: any;
}
