import React, { useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DEFAULT_CENTER = { lat: 24.7136, lng: 46.6753 };

const pinIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function MapClickHandler({ onPick }) {
  useMapEvents({
    click(event) {
      onPick({ lat: event.latlng.lat, lng: event.latlng.lng });
    }
  });

  return null;
}

function MapViewport({ center }) {
  const map = useMap();

  useEffect(() => {
    if (!center) {
      return;
    }

    map.setView([center.lat, center.lng], Math.max(map.getZoom(), 14), {
      animate: true
    });
  }, [center, map]);

  return null;
}

const LocationPickerMap = ({ selectedPosition, onPositionChange }) => {
  const mapCenter = selectedPosition || DEFAULT_CENTER;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
        <MapContainer
          center={[mapCenter.lat, mapCenter.lng]}
          zoom={selectedPosition ? 14 : 6}
          scrollWheelZoom={true}
          style={{ height: '280px', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          />
          <MapClickHandler onPick={onPositionChange} />
          <MapViewport center={selectedPosition} />
          {selectedPosition ? (
            <Marker
              draggable={true}
              icon={pinIcon}
              position={[selectedPosition.lat, selectedPosition.lng]}
              eventHandlers={{
                dragend: (event) => {
                  const next = event.target.getLatLng();
                  onPositionChange({ lat: next.lat, lng: next.lng });
                }
              }}
            />
          ) : null}
        </MapContainer>
      </div>
      <span style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>
        اضغط على الخريطة لتحديد موقع العميل، ثم اسحب الدبوس عند الحاجة لتعديل الموقع بدقة.
      </span>
    </div>
  );
};

export default LocationPickerMap;
