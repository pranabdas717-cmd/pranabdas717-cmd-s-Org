import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useAdvancedMarkerRef } from '@vis.gl/react-google-maps';
import { useState } from 'react';
import { UserLocation } from '../types';

const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';

interface MapComponentProps {
  locations: UserLocation[];
}

export default function MapComponent({ locations }: MapComponentProps) {
  const [selectedUser, setSelectedUser] = useState<UserLocation | null>(null);

  if (!API_KEY) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] bg-gray-100 rounded-2xl border-2 border-dashed border-gray-200">
        <h2 className="text-xl font-bold text-gray-400">Google Maps API Key Required</h2>
        <p className="text-sm text-gray-400 max-w-xs text-center mt-2">
          Please add <strong>GOOGLE_MAPS_PLATFORM_KEY</strong> to your secrets in settings.
        </p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={API_KEY} version="weekly">
      <div className="h-[500px] w-full rounded-2xl overflow-hidden shadow-sm border border-gray-100">
        <Map
          defaultCenter={{ lat: 23.8103, lng: 90.4125 }} // Dhaka coordinates
          defaultZoom={7}
          mapId="SALES_MONITORING_MAP"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
        >
          {locations.map((loc) => (
            <LocationMarker key={loc.id || loc.userId} loc={loc} />
          ))}
        </Map>
      </div>
    </APIProvider>
  );
}

function LocationMarker({ loc }: { loc: UserLocation; key?: string }) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(false);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: loc.lat, lng: loc.lng }}
        onClick={() => setOpen(true)}
      >
        <Pin background="#2563eb" glyphColor="#fff" />
      </AdvancedMarker>
      {open && (
        <InfoWindow anchor={marker} onCloseClick={() => setOpen(false)}>
          <div className="p-1 min-w-[120px]">
            <p className="font-bold text-gray-900">{loc.userName || 'Anonymous'}</p>
            <p className="text-[10px] text-gray-500">
              {loc.timestamp?.toDate ? loc.timestamp.toDate().toLocaleString() : 'Just now'}
            </p>
          </div>
        </InfoWindow>
      )}
    </>
  );
}
