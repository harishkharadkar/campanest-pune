import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Utensils, Home, Hotel, Bed, ShoppingBag, 
  Store, Package, Building2, ClipboardList, Rocket 
} from 'lucide-react';
import { motion } from 'motion/react';
import { NO_FREE_TRIAL_SERVICE_TYPES, PRICING } from '../constants';
import { formatCurrency } from '../lib/utils';

const SERVICES = [
  { id: 'mess', name: 'Mess', icon: Utensils, price: PRICING.mess, desc: 'Provide daily meal services and menu details' },
  { id: 'pg', name: 'PG', icon: Bed, price: PRICING.pg, desc: 'Register your PG or rooms for rent here' },
  { id: 'hostel', name: 'Hostel', icon: Hotel, price: PRICING.hostel, desc: 'List your hostel with facilities for students' },
  { id: 'flat', name: 'Flat / Room', icon: Home, price: PRICING.flat, desc: 'Rentals for students' },
  { id: 'shop', name: 'Shop / Services', icon: ShoppingBag, price: PRICING.shop, desc: 'Stationery, xerox, etc.' },
  { id: 'hotel', name: 'Hotel', icon: Store, price: PRICING.hotel, desc: 'Promote your hotel or food services for students' },
  { id: 'secondhand', name: 'Second Hand Items', icon: Package, price: PRICING.secondhand, desc: 'Sell or buy used items easily' },
  { id: 'blockrent', name: 'Block Renting', icon: Building2, price: PRICING.blockrent, desc: 'Register apartments or commercial spaces for rent' },
  { id: 'avashyakta', name: 'Requirement', icon: ClipboardList, price: PRICING.avashyakta, desc: 'Post your needs like roommate, PG, or flat' },
  { id: 'newopening', name: 'New Opening', icon: Rocket, price: PRICING.newopening, desc: 'Launch your new shop' },
];

export default function SelectService() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col px-6 py-12">
      <h1 className="text-2xl font-bold text-center mb-2">What service do you provide?</h1>
      <p className="text-zinc-400 text-center mb-10 text-sm">Select a category to register your listing</p>

      <div className="grid grid-cols-2 gap-4">
        {SERVICES.map((service) => (
          <motion.button
            key={service.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(`/register-listing/${service.id}`)}
            className="card flex flex-col items-center text-center p-6 hover:border-primary transition-colors"
          >
            <div className="bg-primary/10 p-3 rounded-xl text-primary mb-3">
              <service.icon size={28} />
            </div>
            <h3 className="font-bold text-sm leading-tight">{service.name}</h3>
            <p className="text-primary font-bold text-[10px] mt-1">{formatCurrency(service.price)}/month</p>
            {NO_FREE_TRIAL_SERVICE_TYPES.includes(service.id as any) && (
              <p className="text-[9px] mt-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-bold uppercase tracking-wider">
                No Free Trial
              </p>
            )}
            <p className="text-zinc-500 text-[10px] mt-2 leading-tight">{service.desc}</p>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
