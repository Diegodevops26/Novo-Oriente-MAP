import {FormEvent, useState} from 'react';
import {
  Clock,
  MapPin,
  Navigation,
  Search,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import type {
  DiscoveredPlace,
  PlaceCategory,
  SubCategoryFilter,
} from '../types/places';
import {getCategoryDisplayName} from '../utils/placeClassifier';
import {PlacePhotoBanner} from './PlacePhotoBanner';

export type CategoryFilter = 'all' | PlaceCategory;

interface DirectorySidebarProps {
  places: DiscoveredPlace[];
  selectedPlaceId: string | null;
  categoryFilter: CategoryFilter;
  subCategoryFilter: SubCategoryFilter;
  searchQuery: string;
  isLoading: boolean;
  isSearching: boolean;
  errorMessage: string | null;
  onCategoryChange: (cat: CategoryFilter) => void;
  onSubCategorySelect: (sub: SubCategoryFilter) => void;
  onSearchSubmit: (query: string) => void;
  onResetSearch: () => void;
  onSelectPlace: (place: DiscoveredPlace) => void;
  onRequestRoute: (place: DiscoveredPlace) => void;
  counts: {
    all: number;
    tourist: number;
    commercial: number;
    food: number;
    lodging: number;
  };
}

const SUBCATEGORY_OPTIONS: {
  id: SubCategoryFilter;
  label: string;
  parent: CategoryFilter;
}[] = [
  {id: 'tourist_nature', label: 'Cachoeiras e Natureza', parent: 'tourist'},
  {id: 'tourist_heritage', label: 'Igrejas e Praças', parent: 'tourist'},
  {id: 'food_restaurant', label: 'Restaurantes', parent: 'food'},
  {id: 'food_snack', label: 'Lanchonetes e Cafés', parent: 'food'},
  {id: 'lodging_inn', label: 'Pousadas e Hotéis', parent: 'lodging'},
  {id: 'commercial_center', label: 'Centros e Lojas', parent: 'commercial'},
  {id: 'commercial_market', label: 'Mercados', parent: 'commercial'},
];

export function DirectorySidebar({
  places,
  selectedPlaceId,
  categoryFilter,
  subCategoryFilter,
  searchQuery,
  isLoading,
  isSearching,
  errorMessage,
  onCategoryChange,
  onSubCategorySelect,
  onSearchSubmit,
  onResetSearch,
  onSelectPlace,
  onRequestRoute,
  counts,
}: DirectorySidebarProps) {
  const [inputValue, setInputValue] = useState(searchQuery);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearchSubmit(inputValue.trim());
  };

  const handleClear = () => {
    setInputValue('');
    onResetSearch();
  };

  return (
    <aside className="flex flex-col bg-white border-r border-slate-200 h-full min-h-0">
      <div className="p-4 border-b border-slate-200 space-y-3 shrink-0">
        <div>
          <p className="text-xs font-medium text-teal-700">
            Vale do Mucuri · Minas Gerais
          </p>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-0.5">
            Novo Oriente de Minas
          </h1>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            Explore atrativos naturais, patrimônio histórico, restaurantes, lanchonetes, pousadas e comércio local.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Buscar lanchonete, pousada, restaurante..."
              aria-label="Buscar local em Novo Oriente de Minas"
              className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
            />
            {inputValue && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Limpar busca"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isSearching ? 'Buscando...' : 'Buscar'}
          </button>
        </form>

        <div
          role="tablist"
          aria-label="Filtrar por categoria"
          className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg"
        >
          <button
            type="button"
            role="tab"
            aria-selected={categoryFilter === 'all'}
            onClick={() => onCategoryChange('all')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              categoryFilter === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos <span className="tabular-nums text-slate-500">({counts.all})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={categoryFilter === 'tourist'}
            onClick={() => onCategoryChange('tourist')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              categoryFilter === 'tourist'
                ? 'bg-white text-teal-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Turismo <span className="tabular-nums text-slate-500">({counts.tourist})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={categoryFilter === 'food'}
            onClick={() => onCategoryChange('food')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              categoryFilter === 'food'
                ? 'bg-white text-amber-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Gastronomia <span className="tabular-nums text-slate-500">({counts.food})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={categoryFilter === 'lodging'}
            onClick={() => onCategoryChange('lodging')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              categoryFilter === 'lodging'
                ? 'bg-white text-rose-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pousadas <span className="tabular-nums text-slate-500">({counts.lodging})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={categoryFilter === 'commercial'}
            onClick={() => onCategoryChange('commercial')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              categoryFilter === 'commercial'
                ? 'bg-white text-blue-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Comércio <span className="tabular-nums text-slate-500">({counts.commercial})</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {SUBCATEGORY_OPTIONS.filter(
            (opt) => categoryFilter === 'all' || opt.parent === categoryFilter
          ).map((opt) => {
            const active = subCategoryFilter === opt.id;
            const activeStyle =
              opt.parent === 'tourist'
                ? 'bg-teal-700 text-white border-teal-700'
                : opt.parent === 'food'
                  ? 'bg-amber-700 text-white border-amber-700'
                  : opt.parent === 'lodging'
                    ? 'bg-rose-800 text-white border-rose-800'
                    : 'bg-blue-700 text-white border-blue-700';
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSubCategorySelect(active ? 'all' : opt.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? activeStyle
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-slate-100">
        {isLoading ? (
          <div className="p-4 space-y-3" aria-busy="true">
            {[1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="flex gap-3 p-3 rounded-xl border border-slate-100 animate-pulse"
              >
                <div className="w-20 h-20 rounded-lg bg-slate-200 shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3.5 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                  <div className="h-3 bg-slate-100 rounded w-5/6" />
                </div>
              </div>
            ))}
          </div>
        ) : errorMessage ? (
          <div className="p-6 text-center space-y-3">
            <p className="text-sm font-medium text-slate-800">{errorMessage}</p>
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        ) : places.length === 0 ? (
          <div className="p-6 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-800">
              Nenhum local encontrado com esse filtro
            </p>
            <p className="text-xs text-slate-500">
              Tente outro termo de busca ou redefina os filtros para explorar todos os pontos da cidade.
            </p>
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-2 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Mostrar todos os locais
            </button>
          </div>
        ) : (
          places.map((item) => {
            const isSelected = item.id === selectedPlaceId;
            return (
              <div
                key={item.id}
                className={`p-3.5 transition-colors ${
                  isSelected ? 'bg-slate-50' : 'hover:bg-slate-50/70'
                }`}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectPlace(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectPlace(item);
                    }
                  }}
                  className="flex gap-3 items-start cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded-lg"
                >
                  <PlacePhotoBanner
                    photoUri={item.photoUri}
                    attributions={item.photoAttributions}
                    title={item.displayName}
                    category={item.category}
                    subCategory={item.subCategory}
                    categoryLabel={item.categoryLabel}
                    className="w-20 h-20 rounded-lg shrink-0 border border-slate-200/80"
                    compact
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span
                        className={`font-medium truncate ${
                          item.category === 'tourist'
                            ? 'text-teal-700'
                            : item.category === 'food'
                              ? 'text-amber-700'
                              : item.category === 'lodging'
                                ? 'text-rose-800'
                                : 'text-blue-700'
                        }`}
                      >
                        {getCategoryDisplayName(item.category)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{item.categoryLabel}</span>
                    </div>

                    <h2 className="text-sm font-semibold text-slate-900 mt-0.5 leading-snug line-clamp-1">
                      {item.displayName}
                    </h2>

                    <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                      {item.briefDescription}
                    </p>

                    <div className="flex items-center justify-between gap-2 mt-2">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 tabular-nums min-w-0">
                        {item.rating !== null ? (
                          <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500 shrink-0" />
                            {item.rating.toFixed(1).replace('.', ',')}
                            {item.userRatingCount ? (
                              <span className="text-slate-400 font-normal">
                                ({item.userRatingCount})
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-500 truncate">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">Novo Oriente</span>
                          </span>
                        )}
                        {item.weekdayDescriptions.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 text-slate-500">
                              <Clock className="w-3 h-3 shrink-0" />
                              Horários
                            </span>
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRequestRoute(item);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-teal-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Navigation className="w-3 h-3" />
                        Rota
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 flex items-center justify-between gap-2 shrink-0">
        <span className="inline-flex items-center gap-1.5 truncate">
          <Sparkles className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="truncate">Dados de locais via Google Maps Platform</span>
        </span>
        <span className="tabular-nums font-mono text-slate-600 shrink-0">
          {places.length} {places.length === 1 ? 'local' : 'locais'}
        </span>
      </div>
    </aside>
  );
}
