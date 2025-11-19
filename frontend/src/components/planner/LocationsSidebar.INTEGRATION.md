# LocationsSidebar Integration Guide

## Quick Start Integration

### Step 1: Import the Component

```tsx
import LocationsSidebar from './components/planner/LocationsSidebar';
import { Location, Accommodation } from './types/planner';
```

### Step 2: Set Up State Management

```tsx
import { useState } from 'react';

function YourPlannerComponent() {
  const [selectedLocations, setSelectedLocations] = useState<Location[]>([]);
  const [selectedAccommodations, setSelectedAccommodations] = useState<Accommodation[]>([]);

  // ... rest of component
}
```

### Step 3: Implement Handler Functions

```tsx
const handleRemoveLocation = (index: number) => {
  setSelectedLocations(prev => prev.filter((_, i) => i !== index));
};

const handleRemoveAccommodation = (index: number) => {
  setSelectedAccommodations(prev => prev.filter((_, i) => i !== index));
};
```

### Step 4: Add Component to JSX

```tsx
return (
  <div className="planner-container">
    {/* Your main content */}

    <LocationsSidebar
      locations={selectedLocations}
      accommodations={selectedAccommodations}
      onRemoveLocation={handleRemoveLocation}
      onRemoveAccommodation={handleRemoveAccommodation}
    />
  </div>
);
```

## Complete Integration Example

```tsx
// File: src/pages/PlannerPage.tsx

import React, { useState } from 'react';
import LocationsSidebar from '../components/planner/LocationsSidebar';
import { Location, Accommodation } from '../types/planner';
import './PlannerPage.css';

const PlannerPage: React.FC = () => {
  // State management
  const [selectedLocations, setSelectedLocations] = useState<Location[]>([]);
  const [selectedAccommodations, setSelectedAccommodations] = useState<Accommodation[]>([]);

  // Add location handler
  const handleAddLocation = (location: Location) => {
    setSelectedLocations(prev => [...prev, location]);
  };

  // Add accommodation handler
  const handleAddAccommodation = (accommodation: Accommodation) => {
    setSelectedAccommodations(prev => [...prev, accommodation]);
  };

  // Remove handlers
  const handleRemoveLocation = (index: number) => {
    setSelectedLocations(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveAccommodation = (index: number) => {
    setSelectedAccommodations(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="planner-page">
      {/* Header */}
      <header className="planner-header">
        <h1>여행 계획 짜기</h1>
      </header>

      {/* Main Content */}
      <main className="planner-main">
        {/* Map, Schedule, etc. */}
        <div className="content-area">
          {/* Your content here */}
        </div>

        {/* Sidebar Component */}
        <LocationsSidebar
          locations={selectedLocations}
          accommodations={selectedAccommodations}
          onRemoveLocation={handleRemoveLocation}
          onRemoveAccommodation={handleRemoveAccommodation}
        />
      </main>
    </div>
  );
};

export default PlannerPage;
```

## Integration with Search/Selection Components

### Location Search Integration

```tsx
// LocationSearch.tsx
interface LocationSearchProps {
  onSelectLocation: (location: Location) => void;
}

const LocationSearch: React.FC<LocationSearchProps> = ({ onSelectLocation }) => {
  const handleLocationClick = (location: Location) => {
    // Add to parent's selected locations
    onSelectLocation(location);
  };

  return (
    <div className="location-search">
      {/* Search UI */}
      <button onClick={() => handleLocationClick(someLocation)}>
        선택
      </button>
    </div>
  );
};

// In Parent Component
<LocationSearch onSelectLocation={handleAddLocation} />
```

### Accommodation Search Integration

```tsx
// AccommodationSearch.tsx
interface AccommodationSearchProps {
  onSelectAccommodation: (accommodation: Accommodation) => void;
}

const AccommodationSearch: React.FC<AccommodationSearchProps> = ({
  onSelectAccommodation
}) => {
  const handleAccommodationClick = (accommodation: Accommodation) => {
    onSelectAccommodation(accommodation);
  };

  return (
    <div className="accommodation-search">
      {/* Search UI */}
      <button onClick={() => handleAccommodationClick(someAccommodation)}>
        선택
      </button>
    </div>
  );
};

// In Parent Component
<AccommodationSearch onSelectAccommodation={handleAddAccommodation} />
```

## State Persistence

### Save to LocalStorage

```tsx
import { useEffect } from 'react';

// Save when state changes
useEffect(() => {
  localStorage.setItem('selectedLocations', JSON.stringify(selectedLocations));
}, [selectedLocations]);

useEffect(() => {
  localStorage.setItem('selectedAccommodations', JSON.stringify(selectedAccommodations));
}, [selectedAccommodations]);

// Load on mount
useEffect(() => {
  const savedLocations = localStorage.getItem('selectedLocations');
  const savedAccommodations = localStorage.getItem('selectedAccommodations');

  if (savedLocations) {
    setSelectedLocations(JSON.parse(savedLocations));
  }
  if (savedAccommodations) {
    setSelectedAccommodations(JSON.parse(savedAccommodations));
  }
}, []);
```

### Save to Backend API

```tsx
// Save selections to server
const saveSelections = async () => {
  try {
    await fetch('/api/planner/selections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locations: selectedLocations,
        accommodations: selectedAccommodations
      })
    });
  } catch (error) {
    console.error('Failed to save selections:', error);
  }
};

// Auto-save on changes
useEffect(() => {
  const timer = setTimeout(() => {
    saveSelections();
  }, 1000); // Debounce 1 second

  return () => clearTimeout(timer);
}, [selectedLocations, selectedAccommodations]);
```

## Advanced Features

### Duplicate Prevention

```tsx
const handleAddLocation = (location: Location) => {
  // Check if already exists
  const isDuplicate = selectedLocations.some(
    loc => loc.name === location.name && loc.city === location.city
  );

  if (!isDuplicate) {
    setSelectedLocations(prev => [...prev, location]);
  } else {
    alert('이미 선택된 장소입니다.');
  }
};
```

### Maximum Selection Limit

```tsx
const MAX_LOCATIONS = 10;
const MAX_ACCOMMODATIONS = 5;

const handleAddLocation = (location: Location) => {
  if (selectedLocations.length >= MAX_LOCATIONS) {
    alert(`최대 ${MAX_LOCATIONS}개까지 선택할 수 있습니다.`);
    return;
  }
  setSelectedLocations(prev => [...prev, location]);
};
```

### Clear All Functionality

```tsx
const handleClearAllLocations = () => {
  if (window.confirm('모든 장소를 삭제하시겠습니까?')) {
    setSelectedLocations([]);
  }
};

const handleClearAllAccommodations = () => {
  if (window.confirm('모든 숙소를 삭제하시겠습니까?')) {
    setSelectedAccommodations([]);
  }
};

const handleClearAll = () => {
  if (window.confirm('모든 선택을 초기화하시겠습니까?')) {
    setSelectedLocations([]);
    setSelectedAccommodations([]);
  }
};
```

### Export Functionality

```tsx
const handleExportSelections = () => {
  const data = {
    locations: selectedLocations,
    accommodations: selectedAccommodations,
    exportedAt: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'travel-selections.json';
  link.click();
  URL.revokeObjectURL(url);
};
```

## CSS Integration

### Ensure CSS is Loaded

Make sure the CSS file is imported in your main component or app entry:

```tsx
// In component file
import '../styles/LocationsSidebar.css';

// OR in main App.tsx or index.tsx
import './styles/LocationsSidebar.css';
```

### Prevent Z-Index Conflicts

```css
/* Make sure other fixed/absolute elements don't overlap */
.your-header {
  z-index: 900; /* Less than sidebar's 1000 */
}

.your-modal {
  z-index: 1100; /* More than sidebar's 1000 */
}
```

### Mobile Responsive Container

```css
/* Ensure parent container doesn't hide sidebar */
.planner-page {
  position: relative;
  min-height: 100vh;
  overflow-x: hidden; /* Prevent horizontal scroll */
}

.planner-main {
  position: relative;
  padding-right: 20px; /* Prevent content from being too close to sidebar */
}

@media (max-width: 768px) {
  .planner-main {
    padding-right: 10px;
  }
}
```

## Testing Integration

### Unit Test Example

```tsx
// LocationsSidebar.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import LocationsSidebar from './LocationsSidebar';

describe('LocationsSidebar', () => {
  const mockLocations = [
    { name: '에펠탑', description: '파리', city: '파리' }
  ];

  const mockAccommodations = [
    {
      name: '호텔',
      description: '호텔',
      city: '파리',
      price: '100,000원',
      budget: 'mid',
      type: '호텔'
    }
  ];

  const mockRemoveLocation = jest.fn();
  const mockRemoveAccommodation = jest.fn();

  it('renders with items', () => {
    render(
      <LocationsSidebar
        locations={mockLocations}
        accommodations={mockAccommodations}
        onRemoveLocation={mockRemoveLocation}
        onRemoveAccommodation={mockRemoveAccommodation}
      />
    );

    expect(screen.getByText('에펠탑')).toBeInTheDocument();
    expect(screen.getByText('호텔')).toBeInTheDocument();
  });

  it('calls remove handler when remove button clicked', () => {
    render(
      <LocationsSidebar
        locations={mockLocations}
        accommodations={mockAccommodations}
        onRemoveLocation={mockRemoveLocation}
        onRemoveAccommodation={mockRemoveAccommodation}
      />
    );

    const removeButtons = screen.getAllByRole('button', { name: /제거/ });
    fireEvent.click(removeButtons[0]);

    expect(mockRemoveLocation).toHaveBeenCalledWith(0);
  });
});
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Sidebar not showing
```tsx
// Check CSS import
import '../../styles/LocationsSidebar.css';

// Check parent doesn't hide it
.parent {
  overflow: visible !important;
}
```

#### 2. Toggle button not clickable
```tsx
// Ensure z-index is high enough
.sidebar-toggle {
  z-index: 1001;
  pointer-events: auto;
}
```

#### 3. Items not updating
```tsx
// Make sure you're using immutable updates
setLocations(prev => [...prev]); // ✅ Correct
locations.push(newLocation); // ❌ Wrong
```

#### 4. Animation not smooth
```css
/* Check transitions are not disabled globally */
* {
  transition: none; /* ❌ Remove this if present */
}

/* Ensure individual transition is set */
.locations-sidebar {
  transition: transform 0.3s ease; /* ✅ Add this */
}
```

## Performance Optimization

### Memoize Handlers

```tsx
import { useCallback } from 'react';

const handleRemoveLocation = useCallback((index: number) => {
  setSelectedLocations(prev => prev.filter((_, i) => i !== index));
}, []);

const handleRemoveAccommodation = useCallback((index: number) => {
  setSelectedAccommodations(prev => prev.filter((_, i) => i !== index));
}, []);
```

### Memoize Component

```tsx
import { memo } from 'react';

const LocationsSidebar = memo<LocationsSidebarProps>(({
  locations,
  accommodations,
  onRemoveLocation,
  onRemoveAccommodation
}) => {
  // Component code...
});
```

## Next Steps

1. Test the component in your planner page
2. Integrate with search/selection components
3. Add persistence (localStorage or API)
4. Implement additional features as needed
5. Test on different screen sizes
6. Add analytics tracking if required

## Support

For issues or questions:
- Check the README: `LocationsSidebar.README.md`
- Review structure: `LocationsSidebar.STRUCTURE.md`
- See example: `LocationsSidebar.example.tsx`
- Check original HTML: `/home/playdata/SKN15-FINAL-2TEAM/planner.html` (lines 2548-2565, 3463-3533)
