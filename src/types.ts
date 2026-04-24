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
  | 'advertisement'
  | 'billboard';

export type ServiceType = ListingCategory | 'blockrent' | 'avashyakta' | 'newopening';
export type ListingPlanType = 'monthly' | 'perPost' | 'ad';
export type MessMenuType = 'fixed' | 'daily';

export type MenuItemType = 'Veg' | 'Non-Veg';
export type MenuItemCategory = 'Thali' | 'Combo' | 'Main' | 'Other' | 'food' | 'shop';

export interface MenuItem {
  id?: string;
  itemName: string;
  price: number;
  type: MenuItemType;
  category: MenuItemCategory;
  servingDetails?: string[];
  listingId: string;
  listingName: string;
  location: string;
  createdAt?: any;
}

export interface Rating {
  id?: string;
  uid: string;
  rating: number;
  createdAt: any;
  updatedAt?: any;
}

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
  nearLandmark?: string;
  mapsLink?: string;
  location?: {
    lat: number;
    lng: number;
  } | string;
  phone: string;
  whatsapp?: string;
  photos?: string[];
  active: boolean;
  createdAt: any;
  validUntil: any;
  totalViews?: number;
  views?: number;
  avgRating?: number;
  averageRating?: number;
  totalRatings?: number;
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
  menuItems?: MenuItem[];
  items?: Array<{
    name: string;
    price: number;
    description?: string;
  }>;
  monthlyRate?: number;
  weeklyRate?: number;
  perPlateRate?: number;
  menuType?: MessMenuType;
  weeklyMenu?: Record<string, {
    morning?: string;
    evening?: string;
  } | string>;
  dailyMenu?: Record<string, {
    morning?: string;
    evening?: string;
  }>;
  
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
  trafficLevel?: 'Very High' | 'High' | 'Medium' | 'Low';
  size?: string;
  contactNumber?: string;
  whatsappNumber?: string;

  // Doctor specific
  doctorName?: string;
  specialization?: string;
  timing?: string;
  daysAvailable?: string;
  closedToday?: boolean;
  closedTill?: any;

  // PG / Hostel structured fields
  gender?: 'boys' | 'girls' | 'both';
  roomType?: 'withCot' | 'withoutCot';
  messAvailable?: boolean;
  totalRooms?: number;
  availableRooms?: number;

  // Trust metadata
  lastUpdated?: any;
}
