import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { doc, setDoc, serverTimestamp, collection, addDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, getStorage } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { AREAS, NO_FREE_TRIAL_SERVICE_TYPES, PRICING } from '../constants';
import { Upload, X, Plus, ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { addDays } from 'date-fns';
import { ProviderProfile, ServiceType } from '../types';

export default function RegisterListing() {
  const { type } = useParams<{ type: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [photos, setPhotos] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const hasNoFreeTrial = NO_FREE_TRIAL_SERVICE_TYPES.includes((type || '') as any);
  const pricingEntry = PRICING[(type || '') as keyof typeof PRICING];
  const listingCharge = typeof pricingEntry === 'number' ? pricingEntry : 119;

  const maxPhotos = (type === 'blockrent' || type === 'avashyakta') ? 2 : 5;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      if (photos.length + newFiles.length > maxPhotos) {
        showToast(`Maximum ${maxPhotos} photos allowed for this category`, "error");
        return;
      }
      setPhotos([...photos, ...newFiles]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const uploadPhotoWithBucketFallback = async (file: File, path: string) => {
    const projectId = storage.app.options.projectId || 'campanestpune';
    const buckets = [
      `${projectId}.firebasestorage.app`,
      `${projectId}.appspot.com`
    ];

    let lastError: any = null;

    for (const bucket of buckets) {
      try {
        const bucketStorage = getStorage(storage.app, `gs://${bucket}`);
        const photoRef = ref(bucketStorage, path);
        await uploadBytes(photoRef, file);
        const url = await getDownloadURL(photoRef);
        return url;
      } catch (error) {
        lastError = error;
        console.warn(`RegisterListing: Upload failed for bucket ${bucket}`, error);
      }
    }

    throw lastError;
  };

  const isCorsUploadError = (error: any) => {
    const message = String(error?.message || '').toLowerCase();
    return message.includes('cors') || message.includes('preflight') || message.includes('network request failed');
  };

  const onSubmit = async (data: any) => {
    console.log("RegisterListing: onSubmit called", data);
    if (!user) {
      console.error("RegisterListing: No user found");
      return;
    }
    setUploading(true);
    try {
      const normalizedData: Record<string, any> = { ...data };

      if (type === 'mess') {
        normalizedData.weeklyMenu = {
          monday: String(data.menuMonday || '').trim(),
          tuesday: String(data.menuTuesday || '').trim(),
          wednesday: String(data.menuWednesday || '').trim(),
          thursday: String(data.menuThursday || '').trim(),
          friday: String(data.menuFriday || '').trim(),
          saturday: String(data.menuSaturday || '').trim(),
          sunday: String(data.menuSunday || '').trim()
        };
        delete normalizedData.menuMonday;
        delete normalizedData.menuTuesday;
        delete normalizedData.menuWednesday;
        delete normalizedData.menuThursday;
        delete normalizedData.menuFriday;
        delete normalizedData.menuSaturday;
        delete normalizedData.menuSunday;
      }

      const photoUrls = [];
      let failedUploads = 0;
      let corsBlocked = false;
      for (const photo of photos) {
        if (corsBlocked) {
          failedUploads += 1;
          continue;
        }

        console.log(`RegisterListing: Uploading photo ${photo.name}`);
        const safeName = photo.name.replace(/\s+/g, '_');
        try {
          const url = await uploadPhotoWithBucketFallback(photo, `listings/${user.uid}/${Date.now()}_${safeName}`);
          photoUrls.push(url);
        } catch (error) {
          failedUploads += 1;
          console.warn(`RegisterListing: Failed to upload ${photo.name}`, error);
          if (isCorsUploadError(error)) {
            corsBlocked = true;
          }
        }
      }

      if (failedUploads > 0) {
        if (corsBlocked) {
          showToast("Photo upload blocked by Storage CORS. Listing will be saved without photos.", "info");
        } else {
          showToast(`${failedUploads} photo(s) failed to upload. Listing will be saved without those images.`, "info");
        }
      }

      const listingData = {
        providerId: user.uid,
        serviceType: type,
        ...normalizedData,
        photos: photoUrls,
        active: false,
        featured: false,
        totalViews: 0,
        monthlyViews: 0,
        avgRating: 0,
        totalRatings: 0,
        isVisible: false,
        isFeatured: false,
        priorityScore: 0,
        status: 'pending',
        createdAt: serverTimestamp(),
      };

      console.log("RegisterListing: Saving listing to Firestore");
      await addDoc(collection(db, 'listings'), listingData);
      
      const serviceType = (type || 'mess') as ServiceType;
      const baseCharge = PRICING[serviceType as keyof typeof PRICING] || 119;
      const requiresImmediatePayment = NO_FREE_TRIAL_SERVICE_TYPES.includes(serviceType as any);
      const providerRef = doc(db, 'providers', user.uid);
      const providerSnap = await getDoc(providerRef);
      const existingProvider = providerSnap.exists() ? (providerSnap.data() as Partial<ProviderProfile>) : null;
      const now = new Date();
      const hasActiveSubscription = Boolean(existingProvider?.subscriptionEnd?.toDate?.() && existingProvider.subscriptionEnd.toDate() > now);
      const hasUsedTrial = Boolean(existingProvider?.isFreeTrialUsed);
      let paymentRequiredNow = requiresImmediatePayment;

      const providerPayload: Record<string, any> = {
        uid: user.uid,
        businessName: data.name,
        ownerName: data.ownerName,
        phone: data.phone,
        whatsapp: data.whatsapp,
        serviceType,
        totalMonthlyCharge: baseCharge,
        extraItemCount: existingProvider?.extraItemCount ?? 0,
        planType: existingProvider?.planType ?? 'basic',
        createdAt: existingProvider?.createdAt ?? serverTimestamp()
      };

      if (requiresImmediatePayment) {
        providerPayload.paymentStatus = 'pending';
        providerPayload.status = 'inactive';
        providerPayload.isActive = false;
        providerPayload.isFreeTrialUsed = existingProvider?.isFreeTrialUsed ?? false;
      } else if (!hasUsedTrial) {
        providerPayload.subscriptionStart = serverTimestamp();
        providerPayload.subscriptionEnd = addDays(now, 28);
        providerPayload.isFreeTrialUsed = true;
        providerPayload.paymentStatus = 'paid';
        providerPayload.status = 'active';
        providerPayload.isActive = true;
      } else if (hasActiveSubscription) {
        providerPayload.paymentStatus = existingProvider?.paymentStatus ?? 'paid';
        providerPayload.status = existingProvider?.status ?? 'active';
        providerPayload.isActive = existingProvider?.isActive ?? true;
      } else {
        paymentRequiredNow = true;
        providerPayload.paymentStatus = 'pending';
        providerPayload.status = 'inactive';
        providerPayload.isActive = false;
        providerPayload.isFreeTrialUsed = true;
      }

      console.log(`RegisterListing: Updating provider state (paymentRequired=${paymentRequiredNow})`);
      await setDoc(providerRef, providerPayload, { merge: true });

      console.log("RegisterListing: Listing created successfully, navigating to dashboard");
      if (paymentRequiredNow) {
        showToast("Listing saved. Complete payment to activate and publish it.", "info");
        navigate('/provider-payment');
      } else {
        showToast("Listing submitted for review!", "success");
        navigate('/provider-dashboard');
      }
    } catch (error: any) {
      console.error("RegisterListing: Error creating listing", error);
      showToast(error.message, "error");
      alert("Failed to create listing. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col pb-20">
      <div className="sticky top-0 bg-background z-10 px-4 py-4 border-b border-zinc-800 flex items-center gap-4">
        <button onClick={() => navigate(-1)}><ChevronLeft /></button>
        <h1 className="font-bold text-lg capitalize">Register {type}</h1>
      </div>

      <form className="p-6 space-y-6" onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        onSubmit(Object.fromEntries(formData));
      }}>
        <div className="space-y-4">
          <h3 className="font-bold text-primary">Basic Details</h3>
          <input name="name" placeholder="Business / Listing Name" className="input-field" required />
          <input name="ownerName" placeholder="Owner Name" className="input-field" required />
          <input name="phone" placeholder="Mobile Number" className="input-field" required pattern="[0-9]{10}" />
          <input name="whatsapp" placeholder="WhatsApp Number" className="input-field" required pattern="[0-9]{10}" />
          
          <select name="area" className="input-field" required>
            <option value="">Select Area</option>
            {AREAS.map(area => <option key={area} value={area}>{area}</option>)}
          </select>
          
          <input name="nearCollege" placeholder="Near College" className="input-field" required />
          <textarea name="address" placeholder="Full Address" className="input-field h-24" required />
          <input name="landmark" placeholder="Landmark (Optional)" className="input-field" />
          <input name="mapsLink" placeholder="Google Maps Link (Optional)" className="input-field" />
        </div>

        {type === 'blockrent' && (
          <div className="space-y-4">
            <h3 className="font-bold text-primary">Block Details</h3>
            <select name="blockType" className="input-field" required>
              <option value="shop">Shop Space</option>
              <option value="office">Office Space</option>
              <option value="godown">Godown</option>
              <option value="room">Room</option>
              <option value="open">Open Space</option>
            </select>
            <input name="blockSize" placeholder="Size (e.g. 200 sq ft)" className="input-field" required />
            <select name="rentOrSell" className="input-field" required>
              <option value="rent">Rent Only</option>
              <option value="sell">Sell Only</option>
              <option value="both">Both</option>
            </select>
            <input name="pricePerMonth" type="number" placeholder="Monthly Rent (₹)" className="input-field" />
          </div>
        )}

        {type === 'avashyakta' && (
          <div className="space-y-4">
            <h3 className="font-bold text-primary">Requirement Details</h3>
            <select name="requirementType" className="input-field" required>
              <option value="worker">Need a worker</option>
              <option value="flatmate">Need a flatmate</option>
              <option value="item">Need second hand item</option>
              <option value="delivery">Need delivery person</option>
              <option value="other">Other</option>
            </select>
            <textarea name="requirement" placeholder="Describe exactly what you need..." className="input-field h-32" required maxLength={500} />
            <input name="budget" type="number" placeholder="Budget (₹, Optional)" className="input-field" />
          </div>
        )}

        {type === 'newopening' && (
          <div className="space-y-4">
            <h3 className="font-bold text-primary">Launch Details</h3>
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-500 uppercase font-bold ml-1">Launch Date</label>
              <input name="launchDate" type="date" className="input-field" required />
            </div>
            <textarea name="launchOffer" placeholder="Special Launch Offers (e.g. 50% off on first day)" className="input-field h-24" required />
          </div>
        )}

        {type === 'mess' && (
          <div className="space-y-4">
            <h3 className="font-bold text-primary">Weekly Menu</h3>
            <input name="menuMonday" placeholder="Monday menu" className="input-field" />
            <input name="menuTuesday" placeholder="Tuesday menu" className="input-field" />
            <input name="menuWednesday" placeholder="Wednesday menu" className="input-field" />
            <input name="menuThursday" placeholder="Thursday menu" className="input-field" />
            <input name="menuFriday" placeholder="Friday menu" className="input-field" />
            <input name="menuSaturday" placeholder="Saturday menu" className="input-field" />
            <input name="menuSunday" placeholder="Sunday menu" className="input-field" />
          </div>
        )}

        <div className="space-y-4">

          <h3 className="font-bold text-primary">Photos (Max {maxPhotos})</h3>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-zinc-800">
                <img src={URL.createObjectURL(photo)} alt="Preview" className="w-full h-auto object-contain max-h-[300px]" />
                <button 
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute top-1 right-1 bg-black/50 p-1 rounded-full text-white"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {photos.length < maxPhotos && (
              <label className="aspect-square rounded-lg border-2 border-dashed border-zinc-800 flex flex-col items-center justify-center text-zinc-500 cursor-pointer hover:border-primary transition-colors">
                <Upload size={20} />
                <span className="text-[10px] mt-1">Upload</span>
                <input type="file" className="hidden" accept="image/*" multiple onChange={handlePhotoChange} />
              </label>
            )}
          </div>
        </div>

        <div className="card bg-primary/5 border-primary/20 p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Monthly Listing Charge</span>
            <span className="text-primary font-bold">₹{listingCharge}</span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-2">
            {hasNoFreeTrial ? 
              "No free trial for this category. Immediate payment required after listing." : 
              "Your 28-day free trial will apply automatically."}
          </p>
        </div>

        <button 
          type="submit" 
          disabled={uploading}
          className="btn-primary w-full"
        >
          {uploading ? "Uploading..." : "Submit Listing"}
        </button>
      </form>
    </div>
  );
}
