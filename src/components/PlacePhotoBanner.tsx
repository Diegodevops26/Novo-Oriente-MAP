import {useState} from 'react';
import {
  BedDouble,
  Camera,
  Coffee,
  Landmark,
  Mountain,
  ShoppingBag,
  Store,
  Utensils,
} from 'lucide-react';
import type {PhotoAttribution, PlaceCategory, SubCategoryFilter} from '../types/places';

interface PlacePhotoBannerProps {
  photoUri: string | null;
  attributions: PhotoAttribution[];
  title: string;
  category: PlaceCategory;
  subCategory: Exclude<SubCategoryFilter, 'all'>;
  categoryLabel: string;
  className?: string;
  compact?: boolean;
}

export function PlacePhotoBanner({
  photoUri,
  attributions,
  title,
  category,
  subCategory,
  categoryLabel,
  className = 'h-40 w-full',
  compact = false,
}: PlacePhotoBannerProps) {
  const [imgError, setImgError] = useState(false);

  const renderFallbackIcon = () => {
    if (subCategory === 'tourist_heritage') {
      return <Landmark className="w-6 h-6 text-teal-700" />;
    }
    if (category === 'tourist') {
      return <Mountain className="w-6 h-6 text-teal-700" />;
    }
    if (subCategory === 'food_snack') {
      return <Coffee className="w-6 h-6 text-amber-700" />;
    }
    if (category === 'food') {
      return <Utensils className="w-6 h-6 text-amber-700" />;
    }
    if (category === 'lodging') {
      return <BedDouble className="w-6 h-6 text-rose-800" />;
    }
    if (subCategory === 'commercial_market') {
      return <Store className="w-6 h-6 text-blue-700" />;
    }
    return <ShoppingBag className="w-6 h-6 text-blue-700" />;
  };

  const getFallbackBg = () => {
    if (category === 'tourist') {
      return 'bg-gradient-to-br from-teal-50 via-emerald-50/70 to-slate-100';
    }
    if (category === 'food') {
      return 'bg-gradient-to-br from-amber-50 via-orange-50/70 to-slate-100';
    }
    if (category === 'lodging') {
      return 'bg-gradient-to-br from-rose-50 via-pink-50/60 to-slate-100';
    }
    return 'bg-gradient-to-br from-blue-50 via-indigo-50/70 to-slate-100';
  };

  const getFallbackBorder = () => {
    if (category === 'tourist') return 'bg-white/90 border-teal-200';
    if (category === 'food') return 'bg-white/90 border-amber-200';
    if (category === 'lodging') return 'bg-white/90 border-rose-200';
    return 'bg-white/90 border-blue-200';
  };

  if (!photoUri || imgError) {
    return (
      <div
        className={`${className} relative flex flex-col items-center justify-center overflow-hidden ${getFallbackBg()}`}
      >
        <div
          className={`flex items-center justify-center rounded-xl border ${
            compact ? 'w-9 h-9' : 'w-11 h-11 mb-1.5'
          } ${getFallbackBorder()}`}
        >
          {renderFallbackIcon()}
        </div>
        {!compact && (
          <span className="text-[11px] font-medium text-slate-600 px-3 text-center truncate max-w-full">
            {categoryLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`${className} relative overflow-hidden bg-slate-100`}>
      <img
        src={photoUri}
        alt={`Foto de ${title}`}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className="w-full h-full object-cover"
      />
      {!compact && attributions.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-2.5 py-1.5 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] text-white/95 truncate">
            <Camera className="w-3 h-3 shrink-0" />
            {attributions[0].uri ? (
              <a
                href={attributions[0].uri}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white truncate"
              >
                Foto: {attributions[0].displayName}
              </a>
            ) : (
              <span className="truncate">Foto: {attributions[0].displayName}</span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
