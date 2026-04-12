export const AREAS = [
  "Kothrud", "Shivajinagar", "Wakad", "Warje",
  "Karve Nagar", "Aundh", "Baner", "Hadapsar",
  "Viman Nagar", "Katraj", "Pimpri", "Other"
];

export const HOME_CATEGORIES = [
  'all',
  'pg',
  'hostel',
  'mess',
  'shop',
  'hotel',
  'block',
  'doctor',
  'requirement',
  'secondhand',
  'advertisement'
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  pg: 'PG',
  hostel: 'Hostel',
  flat: 'Flat',
  mess: 'Mess',
  shop: 'Shop',
  hotel: 'Hotel',
  block: 'Block Renting',
  doctor: 'Doctor for Students',
  requirement: 'Requirement',
  secondhand: 'Second Hand Items',
  advertisement: 'Advertisement'
};

export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  pg: 'Register your PG or rooms for rent here',
  hostel: 'List your hostel with facilities for students',
  mess: 'Provide daily meal services and menu details',
  flat: 'List flats or rooms suitable for students',
  shop: 'Show useful nearby shops and student services',
  hotel: 'Promote your hotel or food services for students',
  block: 'Register apartments or commercial spaces for rent',
  secondhand: 'Sell or buy used items easily',
  requirement: 'Post your needs like roommate, PG, or flat',
  advertisement: 'Promote events, shops, or special offers',
  emergency: 'Access important emergency contacts and services',
  doctor: 'Help students find nearby doctors quickly'
};

export const PRICING = {
  pg: 99,
  hostel: 99,
  flat: 99,
  mess: 99,
  shop: 99,
  hotel: 99,
  block: 199,
  doctor: 99,
  requirement: 49,
  secondhand: 49,
  blockrent: 199,
  avashyakta: 49,
  newopening: 99,
  advertisement: {
    3: 99,
    7: 199,
    15: 399
  },
  extraItem: 39
} as const;

export const NO_FREE_TRIAL_SERVICE_TYPES = ['secondhand', 'block', 'requirement', 'advertisement'] as const;

export const DEFAULT_DURATION: Record<string, number> = {
  pg: 30,
  hostel: 30,
  flat: 30,
  mess: 30,
  shop: 30,
  hotel: 30,
  block: 30,
  doctor: 30,
  requirement: 30,
  secondhand: 30,
  advertisement: 7
};

export const ADMIN_EMAIL = "campanest7@gmail.com";
export const ADMIN_WHATSAPP = "7385670673";
export const ADMIN_UPI = "7385670673@ybl";
