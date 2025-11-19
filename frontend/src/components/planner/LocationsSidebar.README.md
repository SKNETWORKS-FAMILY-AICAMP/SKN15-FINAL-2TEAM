# LocationsSidebar Component

A collapsible sidebar component for displaying and managing selected locations and accommodations in the travel planner application.

## Overview

The LocationsSidebar component is based on the design from `planner.html` (lines 2548-2565 and 3463-3533) and provides a fixed-position sidebar on the right edge of the screen for managing user selections.

## Features

- **Fixed Positioning**: Stays on the right edge of the screen at 50% vertical position
- **Collapsible**: Toggle button with « / » symbols for expand/collapse
- **Two Sections**: Separate display for "선택한 장소" (Selected Locations) and "선택한 숙소" (Selected Accommodations)
- **Count Badges**: Shows total count of selected items (총 X개)
- **Remove Functionality**: Each item has a remove button (×) for easy deletion
- **Smooth Animations**: Slide animation when toggling between open and collapsed states
- **Scrollable**: Content area scrolls if items overflow
- **Navy Theme**: Uses #364C84 as the primary color

## File Structure

```
frontend/src/
├── components/planner/
│   ├── LocationsSidebar.tsx          # Main component
│   ├── LocationsSidebar.example.tsx  # Usage example
│   └── LocationsSidebar.README.md    # This file
├── styles/
│   └── LocationsSidebar.css          # Component styles
└── types/
    └── planner.ts                     # Type definitions
```

## Component Props

```typescript
interface LocationsSidebarProps {
  locations: Location[];              // Array of selected locations
  accommodations: Accommodation[];    // Array of selected accommodations
  onRemoveLocation: (index: number) => void;       // Callback for location removal
  onRemoveAccommodation: (index: number) => void;  // Callback for accommodation removal
}
```

## Type Definitions

### Location
```typescript
interface Location {
  name: string;         // Location name
  description: string;  // Description
  city: string;        // City name
  icon?: string;       // Optional icon
}
```

### Accommodation
```typescript
interface Accommodation {
  name: string;                       // Accommodation name
  description: string;                // Description
  city: string;                      // City name
  price: string;                     // Price per night (e.g., "150,000원")
  budget: 'low' | 'mid' | 'high';   // Budget category
  type: string;                      // Type (e.g., "호텔", "게스트하우스")
}
```

## Usage

### Basic Example

```tsx
import React, { useState } from 'react';
import LocationsSidebar from './components/planner/LocationsSidebar';
import { Location, Accommodation } from './types/planner';

function PlannerPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);

  const handleRemoveLocation = (index: number) => {
    setLocations(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveAccommodation = (index: number) => {
    setAccommodations(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div>
      {/* Your main content */}

      <LocationsSidebar
        locations={locations}
        accommodations={accommodations}
        onRemoveLocation={handleRemoveLocation}
        onRemoveAccommodation={handleRemoveAccommodation}
      />
    </div>
  );
}
```

### Adding Items

```tsx
// Add a location
const addLocation = (newLocation: Location) => {
  setLocations(prev => [...prev, newLocation]);
};

// Add an accommodation
const addAccommodation = (newAccommodation: Accommodation) => {
  setAccommodations(prev => [...prev, newAccommodation]);
};

// Example usage
addLocation({
  name: '에펠탑',
  description: '파리의 상징',
  city: '파리',
  icon: '🗼'
});

addAccommodation({
  name: '호텔 드 라 페',
  description: '부티크 호텔',
  city: '파리',
  price: '150,000원',
  budget: 'mid',
  type: '호텔'
});
```

## Styling

### CSS Classes

- `.locations-sidebar` - Main container
- `.locations-sidebar.collapsed` - Collapsed state
- `.sidebar-toggle` - Toggle button
- `.sidebar-content` - Content area
- `.sidebar-header` - Header with title and count
- `.sidebar-items` - Scrollable items container
- `.sidebar-section` - Section container
- `.section-title` - Section heading
- `.sidebar-item` - Individual item
- `.sidebar-item-info` - Item information
- `.sidebar-item-name` - Item name
- `.sidebar-item-detail` - Item detail (city/price)
- `.sidebar-remove-btn` - Remove button
- `.empty-sidebar` - Empty state message

### Customization

You can customize the appearance by modifying `/home/playdata/SKN15-FINAL-2TEAM/frontend/src/styles/LocationsSidebar.css`:

```css
/* Change primary color */
.sidebar-header h3,
.section-title,
.sidebar-toggle {
  color: #your-color;
  background: #your-color;
}

/* Adjust sidebar width */
.locations-sidebar {
  width: 320px; /* Change from default 280px */
}

/* Modify animation speed */
.locations-sidebar {
  transition: transform 0.5s ease; /* Change from 0.3s */
}
```

## Dimensions

- **Width (Open)**: 280px
- **Width (Collapsed)**: 30px (toggle button only)
- **Height**: 400px
- **Z-index**: 1000
- **Toggle Button**: 30px wide

## Initial State

The component starts in the **open** (not collapsed) state by default. To change this:

```tsx
// In LocationsSidebar.tsx
const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed
```

## Responsive Behavior

The component includes responsive breakpoints:

- **≤768px**: Reduced width (260px) and height (350px)
- **≤480px**: Further reduced width (240px) and height (300px)

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- IE11+ (with polyfills for CSS variables if needed)

## Accessibility

- Remove buttons include `aria-label` for screen readers
- Keyboard navigation supported
- Focus states on interactive elements
- Semantic HTML structure

## Performance Considerations

- Uses React functional components and hooks
- Minimal re-renders through proper key usage
- CSS transitions for smooth animations
- Efficient array filtering for removals

## Troubleshooting

### Sidebar not visible
- Check z-index conflicts with other components
- Ensure parent container doesn't have `overflow: hidden`
- Verify CSS file is properly imported

### Toggle not working
- Check that state is managed correctly
- Ensure onClick handler is properly bound
- Verify CSS transitions are not disabled

### Items not displaying
- Confirm data format matches type definitions
- Check array length and mapping logic
- Verify CSS styles are loaded

## Related Files

- Component: `/home/playdata/SKN15-FINAL-2TEAM/frontend/src/components/planner/LocationsSidebar.tsx`
- Styles: `/home/playdata/SKN15-FINAL-2TEAM/frontend/src/styles/LocationsSidebar.css`
- Types: `/home/playdata/SKN15-FINAL-2TEAM/frontend/src/types/planner.ts`
- Example: `/home/playdata/SKN15-FINAL-2TEAM/frontend/src/components/planner/LocationsSidebar.example.tsx`
- Original HTML: `/home/playdata/SKN15-FINAL-2TEAM/planner.html` (lines 2548-2565, 3463-3533)

## Future Enhancements

- Add drag-and-drop reordering
- Implement search/filter functionality
- Add export functionality for selected items
- Include item preview on hover
- Support for categories/tags
- Bulk operations (clear all, select all)

## License

Part of SKN15-FINAL-2TEAM project.
