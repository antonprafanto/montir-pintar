import React, { useEffect, useState } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary, InfoWindow, useAdvancedMarkerRef } from '@vis.gl/react-google-maps';
import { MapPin, Navigation, Info, AlertTriangle } from 'lucide-react';

// @ts-ignore
const envObj = typeof window !== 'undefined' && window.process && window.process.env ? window.process.env : process.env;
const API_KEY = envObj.GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

const MarkerWithInfoWindow: React.FC<{
  position: google.maps.LatLngLiteral;
  place: google.maps.places.Place;
}> = ({ position, place }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(false);

  return (
    <>
      <AdvancedMarker ref={markerRef} position={position} onClick={() => setOpen(true)}>
        <Pin background="#FFDE59" glyphColor="#000" borderColor="#000" />
      </AdvancedMarker>
      {open && (
        <InfoWindow anchor={marker} onCloseClick={() => setOpen(false)} style={{ padding: 0 }}>
          <div className="p-3 bg-white text-black font-sans rounded-lg">
            <h4 className="font-black text-lg mb-1">{place.displayName}</h4>
            <p className="text-sm font-bold opacity-80 mb-2">{place.formattedAddress}</p>
            {place.rating && (
              <p className="text-sm font-bold text-yellow-600 mb-2">⭐ {place.rating} ({place.userRatingCount} ulasan)</p>
            )}
            <a 
              href={`https://www.google.com/maps/dir/?api=1&destination=${place.location?.lat()},${place.location?.lng()}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#00FC73] text-black font-black text-sm rounded-md border-2 border-black hover:bg-[#00FC73]/80 transition-colors"
            >
              <Navigation className="w-4 h-4" />
              Petunjuk Arah
            </a>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

function PlacesSearch({ location, keyword }: { location: google.maps.LatLngLiteral; keyword: string }) {
  const placesLib = useMapsLibrary('places');
  const map = useMap();
  const [places, setPlaces] = useState<google.maps.places.Place[]>([]);

  useEffect(() => {
    if (!placesLib || !map || !location) return;

    // We use searchNearby instead of text search because we want to restrict by radius precisely
    // Actually, `searchNearby` takes includedPrimaryTypes, which is good for generic "car_repair".
    // Alternatively, `searchByText` allows keyword like "Bengkel Motor" + location bias/restriction.
    // Let's use searchByText since it's more flexible for "Bengkel Yamaha" or similar.
    
    placesLib.Place.searchByText({
      textQuery: keyword,
      fields: ['displayName', 'location', 'formattedAddress', 'rating', 'userRatingCount'],
      locationBias: {
        center: new google.maps.LatLng(location.lat, location.lng),
        radius: 10000,
      },
      maxResultCount: 15,
    }).then(({ places }) => {
      setPlaces(places);
      if (places.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(location);
        places.forEach(p => {
          if (p.location) bounds.extend(p.location);
        });
        map.fitBounds(bounds);
      }
    }).catch(e => {
        console.error("Error searching places:", e);
    });
  }, [placesLib, map, location, keyword]);

  return (
    <>
      <AdvancedMarker position={location} title="Lokasi Anda">
        <div className="w-4 h-4 bg-[#FF4444] border-2 border-white rounded-full shadow-[0_0_0_2px_rgba(0,0,0,1)]" />
      </AdvancedMarker>

      {places.map((p, i) => p.location ? (
        <MarkerWithInfoWindow key={p.id || i} position={{ lat: p.location.lat(), lng: p.location.lng() }} place={p} />
      ) : null)}
    </>
  );
}

export function NearbyGarages({ vehicleType = 'Kendaraan' }: { vehicleType?: string }) {
  const [location, setLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const keyword = `Bengkel ${vehicleType}`;

  const requestLocation = () => {
    setIsLocating(true);
    setErrorStatus(null);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setIsLocating(false);
        },
        (error) => {
          console.error("Error getting location", error);
          setErrorStatus('Gagal mendapatkan lokasi. Cek izin lokasi di browser Anda.');
          // Default to Jakarta
          setLocation({ lat: -6.2088, lng: 106.8456 });
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setErrorStatus('Browser tidak mendukung deteksi lokasi.');
      setLocation({ lat: -6.2088, lng: 106.8456 });
      setIsLocating(false);
    }
  };

  if (!hasValidKey) {
    return (
      <div className="bg-surface-secondary p-5 sm:p-6 neo-box flex flex-col neo-shadow mt-6 sm:mt-8">
        <h3 className="text-lg sm:text-xl font-black mb-4 flex items-center gap-2 sm:gap-3 neo-text">
          <MapPin className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" strokeWidth={3} />
          Pencarian Bengkel Terdekat
        </h3>
        <div className="p-4 border-4 neo-border bg-[#FFDE59] rounded-xl flex items-start gap-3 sm:gap-4 flex-col sm:flex-row">
          <Info className="w-6 h-6 flex-shrink-0 mt-0.5" />
          <div className="text-sm font-bold">
            <p>Fitur pencarian bengkel memerlukan <strong>Google Maps API Key</strong>.</p>
            <p className="mt-2">Tambahkan key melalui menu <strong>Settings (ikon ⚙️ roda gigi)</strong> di pojok kanan atas layar AI Studio Anda, masuk ke tab <strong>Secrets</strong>, lalu tambahkan key dengan nama <code>GOOGLE_MAPS_PLATFORM_KEY</code>.</p>
            <p className="mt-3">
              <a href="https://developers.google.com/maps/documentation/javascript/get-api-key" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-black bg-white/50 px-2 py-1 border-2 border-black rounded-md hover:bg-white transition-colors">
                Cara mendapatkan API Key (Panduan Resmi)
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-secondary p-5 sm:p-8 neo-box flex flex-col neo-shadow mt-6 sm:mt-8 break-inside-avoid">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 border-b-4 neo-border pb-3 sm:pb-4 gap-3 sm:gap-4">
         <h3 className="text-lg sm:text-xl font-black flex items-center gap-2 sm:gap-3 neo-text">
           <MapPin className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" strokeWidth={3} />
           Bengkel {vehicleType} Terdekat 📍
         </h3>
         {!location && !isLocating && (
           <button
             onClick={requestLocation}
             className="w-full sm:w-auto px-4 py-2 bg-[#00FC73] text-black font-black border-4 neo-border rounded-xl hover:scale-105 transition-transform neo-shadow-sm flex items-center justify-center gap-2"
           >
             <Navigation className="w-4 h-4" strokeWidth={3} />
             Cari Bengkel!
           </button>
         )}
         {isLocating && (
             <span className="font-bold flex items-center justify-center sm:justify-start gap-2 px-4 py-2 w-full sm:w-auto"><MapPin className="w-4 h-4 animate-bounce" /> Mang AI Lacak...</span>
         )}
       </div>

      {errorStatus && (
        <div className="mb-4 p-3 border-4 neo-border bg-[#FF90E8] rounded-xl text-black font-bold flex items-center gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          {errorStatus} (Menggunakan lokasi default: Jakarta)
        </div>
      )}

      {location ? (
        <div className="h-[400px] w-full border-4 neo-border rounded-xl overflow-hidden bg-gray-200">
           <APIProvider apiKey={API_KEY} version="weekly">
             <Map
               defaultCenter={location}
               defaultZoom={14}
               mapId="4jg3i2mbc_bengkel"
               internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
               style={{ width: '100%', height: '100%' }}
             >
               <PlacesSearch location={location} keyword={keyword} />
             </Map>
           </APIProvider>
        </div>
      ) : (
        <div className="h-[200px] w-full border-4 neo-border rounded-xl bg-gray-100 flex items-center justify-center text-center p-6 flex-col gap-3">
            <MapPin className="w-10 h-10 text-gray-400" />
            <p className="font-bold text-gray-500">Klik "Cari Bengkel!" biar Mang AI tunjukin bengkel rekomended di sekitarmu.</p>
        </div>
      )}
    </div>
  );
}
