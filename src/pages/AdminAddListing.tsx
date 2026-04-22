import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { addDoc, collection, deleteField, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { addDays } from 'date-fns';
import { Camera, ChevronLeft, GripVertical, RefreshCcw, Upload, X } from 'lucide-react';
import { db } from '../lib/firebase';
import { AREAS, CATEGORY_LABELS, PRICING } from '../constants';
import { useToast } from '../components/Toast';
import MenuItemInput, { DraftMenuItem } from '../components/MenuItemInput';
import { Listing, ListingCategory, ListingPlanType, MenuItem } from '../types';
import { getOptimizedUrl, optimizeCloudinaryUrl, uploadToCloudinary } from '../lib/cloudinary';

const CATEGORIES: ListingCategory[] = [
  'pg', 'hostel', 'flat', 'mess', 'shop', 'hotel', 'block', 'doctor', 'requirement', 'secondhand', 'advertisement'
];
const FOOD_AND_SHOP_CATEGORIES: ListingCategory[] = ['mess', 'hotel', 'shop'];
const MIN_PHOTOS = 4;
const MAX_PHOTOS = 5;

type UploadStatus = 'uploading' | 'uploaded' | 'error';
type UploadItem = {
  id: string;
  file?: File;
  previewUrl: string;
  progress: number;
  status: UploadStatus;
  uploadedUrl?: string;
  error?: string;
};

type LocalMenuItem = {
  itemName: string;
  price: number;
  type: 'Veg' | 'Non-Veg';
  category: 'Thali' | 'Combo' | 'Main' | 'Other';
  servingDetails?: string;
};

const normalizeMenuItems = (items: Partial<MenuItem>[] = []): LocalMenuItem[] => {
  return items
    .map((item) => ({
      itemName: String(item.itemName || '').trim(),
      price: Number(item.price || 0),
      type: (item.type === 'Non-Veg' ? 'Non-Veg' : 'Veg') as LocalMenuItem['type'],
      category: ['Thali', 'Combo', 'Main', 'Other'].includes(String(item.category)) ? (item.category as LocalMenuItem['category']) : 'Other',
      servingDetails: Array.isArray(item.servingDetails) ? item.servingDetails.join('\n') : ''
    }))
    .filter((item) => item.itemName && item.price > 0);
};

const toServingDetailsArray = (value?: string): string[] => {
  return String(value || '')
    .split(/\r?\n|,|•|·|\|/)
    .map((part) => part.trim())
    .filter(Boolean);
};

const buildPlan = (category: ListingCategory, adDuration: number): { pricePlan: number; duration: number; planType: ListingPlanType } => {
  if (category === 'advertisement') {
    const price = (PRICING.advertisement as Record<number, number>)[adDuration] || 199;
    return { pricePlan: price, duration: adDuration, planType: 'ad' };
  }
  if (category === 'requirement') return { pricePlan: PRICING.requirement, duration: 30, planType: 'perPost' };
  if (category === 'secondhand') return { pricePlan: PRICING.secondhand, duration: 30, planType: 'perPost' };
  if (category === 'block') return { pricePlan: PRICING.block, duration: 30, planType: 'monthly' };
  if (category === 'doctor') return { pricePlan: PRICING.doctor, duration: 30, planType: 'monthly' };
  return { pricePlan: PRICING[category], duration: 30, planType: 'monthly' };
};

const parseLocationCoordinates = (raw: string): { lat: number; lng: number } | null => {
  const value = raw.trim();
  if (!value) return null;

  const parts = value.split(',').map((part) => part.trim());
  if (parts.length !== 2) {
    throw new Error('Location must be in "Latitude, Longitude" format.');
  }

  const lat = Number(parts[0]);
  const lng = Number(parts[1]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Location coordinates must be valid numbers.');
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error('Latitude must be between -90 to 90 and longitude between -180 to 180.');
  }

  return { lat, lng };
};

const toLocationInputValue = (listing?: Partial<Listing> | null) => {
  const lat = listing?.location?.lat;
  const lng = listing?.location?.lng;
  if (typeof lat !== 'number' || typeof lng !== 'number') return '';
  return `${lat}, ${lng}`;
};

const getListingImages = (listing?: Partial<Listing> | null) => {
  if (!listing) return [] as string[];
  const fromImages = Array.isArray((listing as any).images) ? ((listing as any).images as string[]) : [];
  const fromPhotos = Array.isArray((listing as any).photos) ? ((listing as any).photos as string[]) : [];
  return [...fromImages, ...fromPhotos].map((url) => String(url || '').trim()).filter(Boolean);
};

const createUploadItemId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const toUploadItemsFromUrls = (urls: string[]): UploadItem[] => {
  return urls.slice(0, MAX_PHOTOS).map((url) => ({
    id: createUploadItemId(),
    previewUrl: getOptimizedUrl(url, 'thumb') || url,
    progress: 100,
    status: 'uploaded',
    uploadedUrl: url
  }));
};

export default function AdminAddListing() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();

  const editId = (searchParams.get('id') || '').trim();
  const isEditMode = Boolean(editId);

  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingListing, setLoadingListing] = useState(false);
  const [category, setCategory] = useState<ListingCategory>('mess');
  const [adDuration, setAdDuration] = useState(7);
  const [initialListing, setInitialListing] = useState<Partial<Listing> | null>(null);
  const [menuItems, setMenuItems] = useState<LocalMenuItem[]>([]);
  const [formVersion, setFormVersion] = useState(0);

  const planPreview = useMemo(() => buildPlan(category, adDuration), [category, adDuration]);

  useEffect(() => {
    let active = true;

    const loadListing = async () => {
      if (!isEditMode) {
        setInitialListing(null);
        setCategory('mess');
        setAdDuration(7);
        setMenuItems([]);
        setUploadItems([]);
        setFormVersion((prev) => prev + 1);
        return;
      }

      setLoadingListing(true);
      try {
        const snap = await getDoc(doc(db, 'listings', editId));
        if (!snap.exists()) {
          showToast('Listing not found', 'error');
          navigate('/admin');
          return;
        }

        if (!active) return;

        const data = snap.data() as Partial<Listing>;
        setInitialListing(data);
        setUploadItems(toUploadItemsFromUrls(getListingImages(data)));
        const inlineMenuItems = normalizeMenuItems((data.menuItems as Partial<MenuItem>[]) || []);
        setMenuItems(inlineMenuItems);

        const loadedCategory = data.category;
        if (loadedCategory && CATEGORIES.includes(loadedCategory)) {
          setCategory(loadedCategory);
          if (loadedCategory === 'advertisement' && typeof data.duration === 'number' && [3, 7, 15].includes(data.duration)) {
            setAdDuration(data.duration);
          }
        }

        const menuSnap = await getDocs(query(collection(db, 'menuItems'), where('listingId', '==', editId)));
        if (menuSnap.docs.length > 0) {
          const fetchedMenuItems = normalizeMenuItems(menuSnap.docs.map((itemDoc) => itemDoc.data() as Partial<MenuItem>));
          if (fetchedMenuItems.length > 0) {
            setMenuItems(fetchedMenuItems);
          }
        }

        setFormVersion((prev) => prev + 1);
      } catch (error: any) {
        showToast(error?.message || 'Failed to load listing', 'error');
      } finally {
        if (active) setLoadingListing(false);
      }
    };

    void loadListing();

    return () => {
      active = false;
    };
  }, [editId, isEditMode, navigate, showToast]);

  useEffect(() => {
    return () => {
      uploadItems.forEach((item) => {
        if (item.file && item.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, [uploadItems]);

  const uploadSingleFile = async (itemId: string, file: File) => {
    try {
      const uploadedUrl = await uploadToCloudinary(file, (progress) => {
        setUploadItems((prev) => prev.map((item) => (
          item.id === itemId ? { ...item, progress } : item
        )));
      });

      setUploadItems((prev) => prev.map((item) => (
        item.id === itemId
          ? {
              ...item,
              status: 'uploaded',
              progress: 100,
              uploadedUrl,
              previewUrl: getOptimizedUrl(uploadedUrl, 'thumb') || uploadedUrl,
              error: undefined
            }
          : item
      )));

      return true;
    } catch (error: any) {
      setUploadItems((prev) => prev.map((item) => (
        item.id === itemId
          ? {
              ...item,
              status: 'error',
              progress: 0,
              error: String(error?.message || 'Upload failed')
            }
          : item
      )));
      return false;
    }
  };

  const handleIncomingFiles = async (incomingFiles: File[]) => {
    const validFiles = incomingFiles.filter((file) => file.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    if (uploadItems.length + validFiles.length > MAX_PHOTOS) {
      showToast('Maximum 5 images allowed per listing', 'error');
      return;
    }

    const queuedItems: UploadItem[] = validFiles.map((file) => ({
      id: createUploadItemId(),
      file,
      previewUrl: URL.createObjectURL(file),
      progress: 0,
      status: 'uploading'
    }));

    console.log('[AdminAddListing] file selected', validFiles.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type
    })));

    setUploadItems((prev) => [...prev, ...queuedItems]);

    const uploadResults = await Promise.all(queuedItems.map((item) => uploadSingleFile(item.id, item.file as File)));
    if (uploadResults.every(Boolean)) {
      showToast('Images uploaded successfully', 'success');
    } else {
      showToast('Some uploads failed. Use retry button.', 'error');
    }
  };

  const onPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    await handleIncomingFiles(Array.from(e.target.files as FileList));
    e.target.value = '';
  };

  const retryUpload = async (itemId: string) => {
    const target = uploadItems.find((item) => item.id === itemId);
    if (!target?.file) return;

    setUploadItems((prev) => prev.map((item) => (
      item.id === itemId ? { ...item, status: 'uploading', progress: 0, error: undefined } : item
    )));

    const ok = await uploadSingleFile(itemId, target.file);
    if (ok) showToast('Images uploaded successfully', 'success');
    else showToast('Upload failed. Use retry button.', 'error');
  };

  const removePhoto = (index: number) => {
    setUploadItems((prev) => {
      const target = prev[index];
      if (target?.file && target.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const onDropFiles = async (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragActive(false);
    const incoming = Array.from(event.dataTransfer.files || []);
    await handleIncomingFiles(incoming);
  };

  const onDragStartPhoto = (index: number) => setDraggedIndex(index);
  const onDropPhoto = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;
    setUploadItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(draggedIndex, 1);
      next.splice(index, 0, moved);
      return next;
    });
    setDraggedIndex(null);
  };

  const allowsImages = true;

  const addMenuItem = (item: DraftMenuItem) => {
    setMenuItems((prev) => [
      ...prev,
      {
        itemName: item.itemName,
        price: Number(item.price),
        type: item.type,
        category: item.category,
        servingDetails: item.servingDetails || ''
      }
    ]);
  };

  const removeMenuItem = (index: number) => {
    setMenuItems((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);

    try {
      const formData = new FormData(e.currentTarget);
      const getText = (key: string) => String(formData.get(key) || '').trim();
      const getNum = (key: string, fallback = 0) => {
        const raw = String(formData.get(key) || '').trim();
        const n = Number(raw);
        return Number.isFinite(n) ? n : fallback;
      };

      const parsedLocation = parseLocationCoordinates(getText('locationCoordinates'));
      const closedTillRaw = getText('closedTill');
      const hasUploading = uploadItems.some((item) => item.status === 'uploading');
      if (hasUploading) {
        showToast('Please wait for image uploads to complete', 'info');
        setSaving(false);
        return;
      }

      const uploadedUrls = uploadItems
        .filter((item) => item.status === 'uploaded' && item.uploadedUrl)
        .map((item) => String(item.uploadedUrl))
        .slice(0, MAX_PHOTOS);

      if (allowsImages && uploadedUrls.length < MIN_PHOTOS) {
        showToast('Please upload at least 4 images', 'info');
        setSaving(false);
        return;
      }

      const finalImages = uploadedUrls;
      const plan = buildPlan(category, adDuration);
      const durationDefault = isEditMode ? Number(initialListing?.duration || plan.duration) : 30;
      const duration = getNum('duration', durationDefault);
      const validUntil = addDays(new Date(), duration);

      const listing: Record<string, any> = {
        name: getText('name') || getText('title') || getText('itemName'),
        category,
        area: getText('area'),
        nearCollege: getText('nearCollege'),
        address: getText('address'),
        phone: getText('phone'),
        whatsapp: getText('whatsapp'),
        description: getText('description'),
        images: finalImages,
        photos: finalImages,
        providerId: initialListing?.providerId || 'admin-managed',

        totalViews: getNum('totalViews', Number(initialListing?.totalViews || 0)),
        views: getNum('totalViews', Number((initialListing as any)?.views || initialListing?.totalViews || 0)),
        avgRating: getNum('avgRating', Number(initialListing?.avgRating || 0)),
        averageRating: getNum('avgRating', Number((initialListing as any)?.averageRating || initialListing?.avgRating || 0)),
        totalRatings: getNum('totalRatings', Number(initialListing?.totalRatings || 0)),
        priorityScore: getNum('priorityScore', Number(initialListing?.priorityScore || 50)),
        isFeatured: formData.get('isFeatured') === 'on',
        isSponsored: formData.get('isSponsored') === 'on',
        active: initialListing?.active ?? true,

        pricePlan: getNum('pricePlan', Number(initialListing?.pricePlan || plan.pricePlan)),
        duration,
        planType: (formData.get('planType') as ListingPlanType) || initialListing?.planType || plan.planType,
        validUntil: isEditMode ? (initialListing?.validUntil || validUntil) : validUntil,
        lastUpdated: serverTimestamp()
      };

      if (parsedLocation) {
        listing.location = parsedLocation;
      } else if (isEditMode) {
        listing.location = deleteField();
      }

      if (!allowsImages) {
        if (isEditMode) {
          listing.images = deleteField();
          listing.photos = deleteField();
          listing.image = deleteField();
          if (category !== 'advertisement') listing.bannerImage = deleteField();
        } else {
          listing.images = [];
          listing.photos = [];
        }
      }

      if (category === 'mess') {
        listing.monthlyRate = getNum('monthlyRate');
        listing.weeklyRate = getNum('weeklyRate');
        listing.perPlateRate = getNum('perPlateRate');
        listing.weeklyMenu = {
          monday: getText('menuMonday'),
          tuesday: getText('menuTuesday'),
          wednesday: getText('menuWednesday'),
          thursday: getText('menuThursday'),
          friday: getText('menuFriday'),
          saturday: getText('menuSaturday'),
          sunday: getText('menuSunday')
        };
        listing.specialOccasionOffer = getText('specialOccasionOffer');
        listing.unlimitedAvailable = formData.get('unlimitedAvailable') === 'on';
        listing.unlimitedPrice = getNum('unlimitedPrice');
        listing.menuItems = menuItems.map((item) => ({
          itemName: item.itemName,
          price: item.price,
          type: item.type,
          category: item.category,
          servingDetails: toServingDetailsArray(item.servingDetails)
        }));
        listing.items = menuItems
          .filter((item) => item.itemName && Number(item.price) > 0)
          .map((item) => ({
            name: item.itemName,
            price: Number(item.price),
            description: String(item.servingDetails || '')
          }));
      }

      if (category === 'pg' || category === 'hostel' || category === 'flat') {
        listing.roomTypes = getText('roomTypes');
        listing.pricePerMonth = getNum('pricePerMonth');
        listing.price = listing.pricePerMonth;
        listing.facilities = getText('facilities').split(',').map((v) => v.trim()).filter(Boolean);
        listing.gender = getText('gender') || 'both';
        listing.roomType = getText('roomType') || 'withCot';
        listing.messAvailable = formData.get('messAvailable') === 'on';
        listing.totalRooms = getNum('totalRooms');
        listing.availableRooms = getNum('availableRooms');
        listing.roomsAvailable = listing.availableRooms;
      }

      if (category === 'hotel') {
        listing.specialOccasionOffer = getText('hotelSpecialOffer');
        listing.unlimitedAvailable = formData.get('hotelUnlimited') === 'on';
        listing.menuItems = menuItems.map((item) => ({
          itemName: item.itemName,
          price: item.price,
          type: item.type,
          category: item.category,
          servingDetails: toServingDetailsArray(item.servingDetails)
        }));
        listing.items = menuItems
          .filter((item) => item.itemName && Number(item.price) > 0)
          .map((item) => ({
            name: item.itemName,
            price: Number(item.price),
            description: String(item.servingDetails || '')
          }));
        listing.foodItems = menuItems.map((item) => item.itemName).filter(Boolean).join(', ');
      }

      if (category === 'shop') {
        listing.menuItems = menuItems.map((item) => ({
          itemName: item.itemName,
          price: item.price,
          type: item.type,
          category: item.category,
          servingDetails: toServingDetailsArray(item.servingDetails)
        }));
        listing.items = menuItems
          .filter((item) => item.itemName && Number(item.price) > 0)
          .map((item) => ({
            name: item.itemName,
            price: Number(item.price),
            description: String(item.servingDetails || '')
          }));
        listing.shopItems = menuItems.map((item) => item.itemName).filter(Boolean).join(', ');
      }

      if (!FOOD_AND_SHOP_CATEGORIES.includes(category) && isEditMode) {
        listing.items = deleteField();
      }

      if (category === 'block') {
        listing.blockType = getText('blockType');
        listing.blockSize = getText('blockSize');
        listing.rentOrSell = getText('rentOrSell').toLowerCase() || 'rent';
        listing.pricePerMonth = getNum('pricePerMonth');
        listing.sellingPrice = getNum('sellingPrice');
      }

      if (category === 'requirement') {
        listing.requirementType = getText('requirementType');
        listing.requirementText = getText('requirementText');
        listing.requirement = listing.requirementText;
        listing.budget = getNum('budget');
        listing.urgency = getText('urgency');
      }

      if (category === 'secondhand') {
        listing.itemName = getText('itemName');
        listing.price = getNum('itemPrice');
        listing.condition = getText('condition').toLowerCase() || 'used';
        listing.image = String(finalImages[0] || '').trim();
      }

      if (category === 'advertisement') {
        listing.title = getText('title');
        listing.bannerImage = String(finalImages[0] || '').trim();
        listing.image = listing.bannerImage;
      }

      if (category === 'doctor') {
        listing.doctorName = getText('doctorName') || listing.name;
        listing.name = listing.doctorName;
        listing.specialization = getText('specialization');
        listing.timing = getText('timing');
        listing.daysAvailable = getText('daysAvailable');
        listing.closedToday = formData.get('closedToday') === 'on';
        if (closedTillRaw) {
          const closedTillDate = new Date(`${closedTillRaw}T23:59:59`);
          if (Number.isFinite(closedTillDate.getTime())) {
            listing.closedTill = closedTillDate;
          } else if (isEditMode) {
            listing.closedTill = deleteField();
          }
        } else if (isEditMode) {
          listing.closedTill = deleteField();
        }
      }

      let listingId = editId;
      console.log('[AdminAddListing] firestore save payload', listing);
      if (isEditMode) {
        await updateDoc(doc(db, 'listings', editId), listing as any);
      } else {
        listing.createdAt = serverTimestamp();
        const listingRef = await addDoc(collection(db, 'listings'), listing);
        listingId = listingRef.id;
      }
      console.log('[AdminAddListing] firestore save success', { listingId, mode: isEditMode ? 'edit' : 'create' });

      if (listingId && (category === 'mess' || category === 'hotel' || category === 'shop') && menuItems.length > 0) {
        const existingSnap = await getDocs(query(collection(db, 'menuItems'), where('listingId', '==', listingId)));
        const existingKeys = new Set(
          existingSnap.docs.map((docSnap) => {
            const item = docSnap.data();
            return `${String(item.itemName || '').toLowerCase()}|${Number(item.price || 0)}|${String(item.type || '')}|${String(item.category || '')}`;
          })
        );

        for (const item of menuItems) {
          const dedupeKey = `${item.itemName.toLowerCase()}|${item.price}|${item.type}|${item.category}`;
          if (existingKeys.has(dedupeKey)) continue;

          const menuRef = doc(collection(db, 'menuItems'));
          const itemCategory = category === 'shop' ? 'shop' : 'food';
          await setDoc(menuRef, {
            itemName: item.itemName,
            price: item.price,
            type: item.type,
            category: itemCategory,
            servingDetails: toServingDetailsArray(item.servingDetails),
            listingId,
            listingName: listing.name || getText('name') || 'Listing',
            location: getText('area') || getText('address') || '',
            createdAt: serverTimestamp()
          });
          existingKeys.add(dedupeKey);
        }
      }

      showToast(isEditMode ? 'Listing updated successfully' : 'Listing added successfully', 'success');
      navigate('/admin');
    } catch (error: any) {
      showToast(error?.message || 'Failed to save listing', 'error');
    } finally {
      setSaving(false);
    }
  };

  const initialName = (initialListing?.name || initialListing?.title || initialListing?.itemName || '') as string;
  const initialMenu = initialListing?.weeklyMenu || {};

  return (
    <div className="min-h-screen pb-24">
      <div className="sticky top-0 bg-background z-10 px-4 py-4 border-b border-zinc-800 flex items-center gap-4">
        <button onClick={() => navigate(-1)}><ChevronLeft /></button>
        <h1 className="font-bold text-lg">{isEditMode ? 'Edit Listing (Admin)' : 'Add Listing (Admin)'}</h1>
      </div>

      {loadingListing ? (
        <div className="p-6 text-zinc-500">Loading listing data...</div>
      ) : (
        <form key={formVersion} className="p-6 space-y-6" onSubmit={onSubmit}>
          <div className="space-y-3">
            <input
              name="name"
              placeholder="Name"
              className="input-field"
              defaultValue={initialName}
              required={category !== 'advertisement' && category !== 'secondhand'}
            />
            <select name="category" className="input-field" value={category} onChange={(e) => setCategory(e.target.value as ListingCategory)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
            <select name="area" className="input-field" defaultValue={initialListing?.area || ''} required>
              <option value="">Select Area</option>
              {AREAS.map((area) => <option key={area} value={area}>{area}</option>)}
            </select>
            <input name="nearCollege" placeholder="Near College" className="input-field" defaultValue={initialListing?.nearCollege || ''} required={category !== 'advertisement'} />
            <textarea name="address" placeholder="Address" className="input-field h-20" defaultValue={initialListing?.address || ''} required={category !== 'advertisement'} />
            <input name="phone" placeholder="Contact Number" className="input-field" defaultValue={initialListing?.phone || ''} required />
            <input name="whatsapp" placeholder="WhatsApp Number" className="input-field" defaultValue={initialListing?.whatsapp || ''} required />
            <textarea name="description" placeholder="Description" className="input-field h-24" defaultValue={initialListing?.description || ''} required />
            <input
              name="locationCoordinates"
              placeholder="Location Coordinates (Latitude, Longitude)"
              className="input-field"
              defaultValue={toLocationInputValue(initialListing)}
            />
            <p className="text-[11px] text-zinc-500">Example: 18.6270, 73.7997</p>
          </div>

          {category === 'mess' && (
            <div className="space-y-3">
              <h3 className="font-bold">Mess Fields</h3>
              <input name="monthlyRate" type="number" placeholder="Monthly Rate" className="input-field" defaultValue={initialListing?.monthlyRate || ''} />
              <input name="weeklyRate" type="number" placeholder="Weekly Rate" className="input-field" defaultValue={initialListing?.weeklyRate || ''} />
              <input name="perPlateRate" type="number" placeholder="Per Plate Rate" className="input-field" defaultValue={initialListing?.perPlateRate || ''} />
              <input name="menuMonday" placeholder="Monday menu" className="input-field" defaultValue={initialMenu.monday || initialMenu.Monday || ''} />
              <input name="menuTuesday" placeholder="Tuesday menu" className="input-field" defaultValue={initialMenu.tuesday || initialMenu.Tuesday || ''} />
              <input name="menuWednesday" placeholder="Wednesday menu" className="input-field" defaultValue={initialMenu.wednesday || initialMenu.Wednesday || ''} />
              <input name="menuThursday" placeholder="Thursday menu" className="input-field" defaultValue={initialMenu.thursday || initialMenu.Thursday || ''} />
              <input name="menuFriday" placeholder="Friday menu" className="input-field" defaultValue={initialMenu.friday || initialMenu.Friday || ''} />
              <input name="menuSaturday" placeholder="Saturday menu" className="input-field" defaultValue={initialMenu.saturday || initialMenu.Saturday || ''} />
              <input name="menuSunday" placeholder="Sunday menu" className="input-field" defaultValue={initialMenu.sunday || initialMenu.Sunday || ''} />
              <input name="specialOccasionOffer" placeholder="Special Occasion Offer" className="input-field" defaultValue={initialListing?.specialOccasionOffer || ''} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="unlimitedAvailable" defaultChecked={Boolean(initialListing?.unlimitedAvailable)} /> Unlimited Available</label>
              <input name="unlimitedPrice" type="number" placeholder="Unlimited Price" className="input-field" defaultValue={initialListing?.unlimitedPrice || ''} />
              <MenuItemInput onAdd={addMenuItem} disabled={saving} simpleMode title="Add Mess Item" />
              <div className="space-y-2">
                <p className="text-xs text-zinc-400">Added items: {menuItems.length}</p>
                {menuItems.length === 0 ? (
                  <p className="text-xs text-zinc-500">No menu items added yet.</p>
                ) : (
                  menuItems.map((item, index) => (
                    <div key={`${item.itemName}-${item.price}-${index}`} className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/50">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-sm">{item.itemName}</p>
                          <p className="text-xs text-zinc-400">₹{item.price} · {item.type} · {item.category}</p>
                          {item.servingDetails && <p className="text-xs text-zinc-500 mt-1 whitespace-pre-wrap">{item.servingDetails}</p>}
                        </div>
                        <button type="button" className="text-xs text-red-400" onClick={() => removeMenuItem(index)}>Remove</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {(category === 'pg' || category === 'hostel' || category === 'flat') && (
            <div className="space-y-3">
              <h3 className="font-bold">PG / Flat / Hostel Fields</h3>
              <select name="gender" className="input-field" defaultValue={initialListing?.gender || 'both'}>
                <option value="boys">Boys</option>
                <option value="girls">Girls</option>
                <option value="both">Both</option>
              </select>
              <select name="roomType" className="input-field" defaultValue={initialListing?.roomType || 'withCot'}>
                <option value="withCot">With Cot</option>
                <option value="withoutCot">Without Cot</option>
              </select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="messAvailable" defaultChecked={Boolean(initialListing?.messAvailable)} /> Mess Available</label>
              <input name="totalRooms" type="number" placeholder="Total Rooms" className="input-field" defaultValue={initialListing?.totalRooms || ''} />
              <input name="availableRooms" type="number" placeholder="Available Rooms" className="input-field" defaultValue={initialListing?.availableRooms || ''} />
              <input name="roomTypes" placeholder="Room Types" className="input-field" defaultValue={String((initialListing as any)?.roomTypes || '')} />
              <input name="pricePerMonth" type="number" placeholder="Price per month" className="input-field" defaultValue={initialListing?.pricePerMonth || ''} />
              <input name="facilities" placeholder="Facilities (comma separated)" className="input-field" defaultValue={Array.isArray((initialListing as any)?.facilities) ? (initialListing as any).facilities.join(', ') : ''} />
            </div>
          )}

          {category === 'hotel' && (
            <div className="space-y-3">
              <h3 className="font-bold">Hotel Fields</h3>
              <input name="hotelSpecialOffer" placeholder="Special Offer" className="input-field" defaultValue={initialListing?.specialOccasionOffer || ''} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="hotelUnlimited" defaultChecked={Boolean(initialListing?.unlimitedAvailable)} /> Unlimited Available</label>
              <MenuItemInput onAdd={addMenuItem} disabled={saving} simpleMode title="Add Food Item" />
              <div className="space-y-2">
                <p className="text-xs text-zinc-400">Added items: {menuItems.length}</p>
                {menuItems.length === 0 ? (
                  <p className="text-xs text-zinc-500">No food items added yet.</p>
                ) : (
                  menuItems.map((item, index) => (
                    <div key={`${item.itemName}-${item.price}-${index}`} className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/50">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-sm">{item.itemName}</p>
                          <p className="text-xs text-zinc-400">₹{item.price} · {item.type} · {item.category}</p>
                          {item.servingDetails && <p className="text-xs text-zinc-500 mt-1 whitespace-pre-wrap">{item.servingDetails}</p>}
                        </div>
                        <button type="button" className="text-xs text-red-400" onClick={() => removeMenuItem(index)}>Remove</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {category === 'shop' && (
            <div className="space-y-3">
              <h3 className="font-bold">Shop Items</h3>
              <p className="text-xs text-zinc-500">Add item name and price (stationery, medical, grocery, etc.)</p>
              <MenuItemInput onAdd={addMenuItem} disabled={saving} simpleMode title="Add Shop Item" />
              <div className="space-y-2">
                <p className="text-xs text-zinc-400">Added items: {menuItems.length}</p>
                {menuItems.length === 0 ? (
                  <p className="text-xs text-zinc-500">No shop items added yet.</p>
                ) : (
                  menuItems.map((item, index) => (
                    <div key={`${item.itemName}-${item.price}-${index}`} className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/50">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-sm">{item.itemName}</p>
                          <p className="text-xs text-zinc-400">₹{item.price}</p>
                          {item.servingDetails && <p className="text-xs text-zinc-500 mt-1 whitespace-pre-wrap">{item.servingDetails}</p>}
                        </div>
                        <button type="button" className="text-xs text-red-400" onClick={() => removeMenuItem(index)}>Remove</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {category === 'block' && (
            <div className="space-y-3">
              <h3 className="font-bold">Block Renting Fields</h3>
              <select name="blockType" className="input-field" defaultValue={initialListing?.blockType || 'shop'}>
                <option value="shop">Shop</option>
                <option value="office">Office</option>
                <option value="room">Room</option>
                <option value="open space">Open Space</option>
              </select>
              <input name="blockSize" placeholder="Block Size" className="input-field" defaultValue={initialListing?.blockSize || ''} />
              <select name="rentOrSell" className="input-field" defaultValue={initialListing?.rentOrSell || 'rent'}>
                <option value="rent">Rent</option>
                <option value="sell">Sell</option>
                <option value="both">Both</option>
              </select>
              <input name="pricePerMonth" type="number" placeholder="Price Per Month" className="input-field" defaultValue={initialListing?.pricePerMonth || ''} />
              <input name="sellingPrice" type="number" placeholder="Selling Price" className="input-field" defaultValue={initialListing?.sellingPrice || ''} />
            </div>
          )}

          {category === 'requirement' && (
            <div className="space-y-3">
              <h3 className="font-bold">Requirement Fields</h3>
              <input name="requirementType" placeholder="Requirement Type" className="input-field" defaultValue={initialListing?.requirementType || ''} />
              <textarea name="requirementText" placeholder="Requirement Text" className="input-field h-24" defaultValue={initialListing?.requirementText || ''} />
              <input name="budget" type="number" placeholder="Budget (optional)" className="input-field" defaultValue={initialListing?.budget || ''} />
              <input name="urgency" placeholder="Urgency" className="input-field" defaultValue={initialListing?.urgency || ''} />
            </div>
          )}

          {category === 'secondhand' && (
            <div className="space-y-3">
              <h3 className="font-bold">Second Hand Items Fields</h3>
              <input name="itemName" placeholder="Item Name" className="input-field" defaultValue={initialListing?.itemName || ''} />
              <input name="itemPrice" type="number" placeholder="Item Price" className="input-field" defaultValue={initialListing?.price || ''} />
              <select name="condition" className="input-field" defaultValue={initialListing?.condition || 'used'}>
                <option value="new">New</option>
                <option value="good">Good</option>
                <option value="used">Used</option>
              </select>
            </div>
          )}

          {category === 'advertisement' && (
            <div className="space-y-3">
              <h3 className="font-bold">Advertisement Fields</h3>
              <input name="title" placeholder="Ad Title" className="input-field" defaultValue={initialListing?.title || ''} />
              <select className="input-field" value={adDuration} onChange={(e) => setAdDuration(Number(e.target.value))}>
                <option value={3}>3 days (Rs99)</option>
                <option value={7}>7 days (Rs199)</option>
                <option value={15}>15 days (Rs399)</option>
              </select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isSponsored" defaultChecked={Boolean(initialListing?.isSponsored)} /> Sponsored</label>
            </div>
          )}

          {category === 'doctor' && (
            <div className="space-y-3">
              <h3 className="font-bold">Doctor Fields</h3>
              <input name="doctorName" placeholder="Doctor Name" className="input-field" defaultValue={initialListing?.doctorName || initialListing?.name || ''} required />
              <input name="specialization" placeholder="Specialization (optional)" className="input-field" defaultValue={initialListing?.specialization || ''} />
              <input name="timing" placeholder="Timing (e.g. 10:00 AM - 2:00 PM, 6:00 PM - 9:00 PM)" className="input-field" defaultValue={initialListing?.timing || ''} required />
              <input name="daysAvailable" placeholder="Days Available (optional)" className="input-field" defaultValue={initialListing?.daysAvailable || ''} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="closedToday" defaultChecked={Boolean(initialListing?.closedToday)} />
                Closed Today
              </label>
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Closed Till (optional)</label>
                <input
                  type="date"
                  name="closedTill"
                  className="input-field"
                  defaultValue={initialListing?.closedTill?.toDate?.()?.toISOString?.()?.slice(0, 10) || ''}
                />
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="font-bold">Pricing & Plan</h3>
            <input name="pricePlan" type="number" className="input-field" defaultValue={initialListing?.pricePlan ?? planPreview.pricePlan} />
            <input name="duration" type="number" className="input-field" defaultValue={initialListing?.duration ?? 30} />
            <select name="planType" className="input-field" defaultValue={initialListing?.planType || planPreview.planType}>
              <option value="monthly">monthly</option>
              <option value="perPost">perPost</option>
              <option value="ad">ad</option>
            </select>
          </div>

          <div className="space-y-3">
            <h3 className="font-bold">Admin Control</h3>
            <input name="totalViews" type="number" placeholder="totalViews" className="input-field" defaultValue={initialListing?.totalViews ?? 0} />
            <input name="avgRating" type="number" step="0.1" placeholder="avgRating" className="input-field" defaultValue={initialListing?.avgRating ?? 0} />
            <input name="totalRatings" type="number" placeholder="totalRatings" className="input-field" defaultValue={initialListing?.totalRatings ?? 0} />
            <input name="priorityScore" type="number" placeholder="priorityScore" className="input-field" defaultValue={initialListing?.priorityScore ?? 50} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isFeatured" defaultChecked={Boolean(initialListing?.isFeatured)} /> Featured</label>
            {!isEditMode && <p className="text-xs text-zinc-500">New listings are saved as active by default.</p>}
          </div>

          {allowsImages && (
            <div className="space-y-3">
              <h3 className="font-bold">{allowsSingleImage ? 'Image' : 'Images'}</h3>
              {isEditMode && getListingImages(initialListing).length > 0 && (
                <p className="text-[11px] text-zinc-500">Existing images are kept unless you upload new ones.</p>
              )}
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-zinc-800">
                    <img src={URL.createObjectURL(photo)} alt="Preview" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removePhoto(i)} className="absolute top-1 right-1 bg-black/50 p-1 rounded-full text-white">
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {photos.length < photoLimit && (
                  <label className="aspect-square upload-dropzone flex flex-col items-center justify-center text-text-muted cursor-pointer">
                    <Upload size={20} />
                    <span className="text-[10px] mt-1">{allowsSingleImage ? 'Upload 1' : 'Upload 4-5'}</span>
                    <input type="file" className="hidden" accept="image/*" multiple={allowsMultipleImages} onChange={onPhotoChange} />
                  </label>
                )}
              </div>
            </div>
          )}

          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? (isEditMode ? 'Updating...' : 'Saving...') : (isEditMode ? 'Update Listing' : 'Add Listing')}
          </button>
        </form>
      )}
    </div>
  );
}
