/**
 * LocationsSidebar Usage Example
 *
 * This file demonstrates how to use the LocationsSidebar component
 */

import React, { useState } from 'react';
import LocationsSidebar from './LocationsSidebar';
import { Location, Accommodation } from '../../types/planner';

const LocationsSidebarExample: React.FC = () => {
  // Example state management
  const [locations, setLocations] = useState<Location[]>([
    {
      name: '에펠탑',
      description: '파리의 상징적인 랜드마크',
      city: '파리',
      icon: '🗼'
    },
    {
      name: '루브르 박물관',
      description: '세계 최대의 미술관',
      city: '파리',
      icon: '🎨'
    }
  ]);

  const [accommodations, setAccommodations] = useState<Accommodation[]>([
    {
      name: '호텔 드 라 페',
      description: '시내 중심가의 부티크 호텔',
      city: '파리',
      price: '150,000원',
      budget: 'mid',
      type: '호텔'
    },
    {
      name: '에어비앤비 마레지구',
      description: '트렌디한 마레지구의 아파트',
      city: '파리',
      price: '80,000원',
      budget: 'low',
      type: '게스트하우스'
    }
  ]);

  // Handler functions
  const handleRemoveLocation = (index: number) => {
    setLocations(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveAccommodation = (index: number) => {
    setAccommodations(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddLocation = () => {
    const newLocation: Location = {
      name: '개선문',
      description: '파리의 상징적인 기념비',
      city: '파리',
      icon: '🏛️'
    };
    setLocations(prev => [...prev, newLocation]);
  };

  const handleAddAccommodation = () => {
    const newAccommodation: Accommodation = {
      name: '게스트하우스 몽마르트',
      description: '예술가의 거리 몽마르트',
      city: '파리',
      price: '60,000원',
      budget: 'low',
      type: '게스트하우스'
    };
    setAccommodations(prev => [...prev, newAccommodation]);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>LocationsSidebar Example</h1>

      <div style={{ marginBottom: '20px' }}>
        <button onClick={handleAddLocation} style={{ marginRight: '10px' }}>
          장소 추가
        </button>
        <button onClick={handleAddAccommodation}>
          숙소 추가
        </button>
      </div>

      <div style={{ position: 'relative', height: '600px', border: '1px solid #ccc' }}>
        <p>메인 컨텐츠 영역 (지도, 일정 등)</p>

        {/* LocationsSidebar Component */}
        <LocationsSidebar
          locations={locations}
          accommodations={accommodations}
          onRemoveLocation={handleRemoveLocation}
          onRemoveAccommodation={handleRemoveAccommodation}
        />
      </div>

      <div style={{ marginTop: '20px' }}>
        <h3>Current State:</h3>
        <p>Locations: {locations.length}</p>
        <p>Accommodations: {accommodations.length}</p>
        <p>Total: {locations.length + accommodations.length}</p>
      </div>
    </div>
  );
};

export default LocationsSidebarExample;
