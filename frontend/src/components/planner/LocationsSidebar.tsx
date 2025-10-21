import React, { useState } from 'react';
import { Location, Accommodation } from '../../types/planner';

interface LocationsSidebarProps {
  locations: Location[];
  accommodations: Accommodation[];
  onRemoveLocation: (index: number) => void;
  onRemoveAccommodation: (index: number) => void;
}

const LocationsSidebar: React.FC<LocationsSidebarProps> = ({
  locations,
  accommodations,
  onRemoveLocation,
  onRemoveAccommodation,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const totalCount = locations.length + accommodations.length;

  return (
    <div className={`locations-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-toggle" onClick={toggleSidebar}>
        <span className="sidebar-toggle-icon">{isCollapsed ? '»' : '«'}</span>
        <span className="sidebar-toggle-text">선택한 장소</span>
      </div>

      <div className="sidebar-content">
        <div className="sidebar-header">
          <h3>선택 항목</h3>
          <div className="selected-count">
            총 <span>{totalCount}</span>개
          </div>
        </div>

        <div className="sidebar-items">
          {locations.length === 0 && accommodations.length === 0 ? (
            <div className="empty-sidebar">
              장소와 숙소를 선택해주세요
            </div>
          ) : (
            <>
              {locations.length > 0 && (
                <div className="sidebar-section">
                  <h4 className="section-title">선택한 장소</h4>
                  {locations.map((location, index) => (
                    <div key={`location-${index}`} className="sidebar-item">
                      <div className="sidebar-item-info">
                        <div className="sidebar-item-name">{location.name}</div>
                        {location.city && (
                          <div className="sidebar-item-detail">{location.city}</div>
                        )}
                      </div>
                      <button
                        className="sidebar-remove-btn"
                        onClick={() => onRemoveLocation(index)}
                        aria-label={`${location.name} 제거`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {accommodations.length > 0 && (
                <div className="sidebar-section">
                  <h4 className="section-title">선택한 숙소</h4>
                  {accommodations.map((accommodation, index) => (
                    <div key={`accommodation-${index}`} className="sidebar-item">
                      <div className="sidebar-item-info">
                        <div className="sidebar-item-name">{accommodation.name}</div>
                        <div className="sidebar-item-detail">{accommodation.price}/박</div>
                      </div>
                      <button
                        className="sidebar-remove-btn"
                        onClick={() => onRemoveAccommodation(index)}
                        aria-label={`${accommodation.name} 제거`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LocationsSidebar;
