# TimelineView Component

A React component that displays trip schedules in a continuous vertical timeline format with Material-UI styling.

## File Location
```
/home/playdata/SKN15-FINAL-2TEAM/frontend/src/components/planner/TimelineView.tsx
```

## Overview

The TimelineView component provides a visually appealing way to display multi-day trip schedules. It shows all trip days in a continuous vertical timeline with:
- Timeline dots connecting each day
- Time, location, icon, and description for each schedule item
- Travel information between locations (time, distance, method)
- Edit/delete buttons that appear on hover
- Navy theme (#364C84) matching the application design

## Props

### `tripData` (Required)
- **Type:** `TripData` (Record<number, ScheduleItem[]>)
- **Description:** Object containing schedule items organized by day number
- **Example:**
```typescript
{
  1: [
    {
      time: '09:00',
      location: 'Airport',
      description: 'Departure',
      icon: '✈️',
      travel: {
        time: '3 hours',
        distance: '1,200km',
        method: 'Flight'
      }
    }
  ],
  2: [...],
  3: [...]
}
```

### `onEdit` (Optional)
- **Type:** `(dayNumber: number, itemIndex: number) => void`
- **Description:** Callback function triggered when edit button is clicked
- **Parameters:**
  - `dayNumber`: The day number of the schedule item
  - `itemIndex`: The index of the item within that day

### `onDelete` (Optional)
- **Type:** `(dayNumber: number, itemIndex: number) => void`
- **Description:** Callback function triggered when delete button is clicked
- **Parameters:**
  - `dayNumber`: The day number of the schedule item
  - `itemIndex`: The index of the item within that day

### `onAdd` (Optional)
- **Type:** `(dayNumber: number) => void`
- **Description:** Callback function triggered when "Add Schedule" button is clicked
- **Parameters:**
  - `dayNumber`: The day number where new schedule should be added

## Types

The component uses the following types from `../../types/planner`:

### ScheduleItem
```typescript
interface ScheduleItem {
  time: string;           // e.g., "09:00"
  location: string;       // e.g., "Tokyo Tower"
  description: string;    // e.g., "Visit observation deck"
  icon: string;          // e.g., "🗼"
  travel?: TravelInfo;   // Optional travel information
}
```

### TravelInfo
```typescript
interface TravelInfo {
  time: string;      // e.g., "30 minutes"
  distance: string;  // e.g., "5km"
  method: string;    // e.g., "Subway"
}
```

### TripData
```typescript
type TripData = Record<number, ScheduleItem[]>;
```

## Features

### 1. Continuous Timeline
- Vertical timeline connecting all days
- Visual dots and lines connecting schedule items
- Gradient line styling for visual appeal

### 2. Day Headers
- Sticky day headers that remain visible when scrolling
- Navy gradient background (#364C84)
- Shows day number and total schedule count

### 3. Schedule Items
- Time display with clock emoji
- Location with custom icon
- Detailed description
- Hover effects for better interactivity

### 4. Travel Information
- Displayed between consecutive schedule items
- Shows travel method, duration, and distance
- Distinctive styling with left border accent

### 5. Action Buttons
- Edit and Delete buttons
- Appear on hover for clean interface
- Color-coded (blue for edit, red for delete)
- Optional - only rendered if callbacks provided

### 6. Add Schedule Button
- Displayed at the end of each day
- Allows adding new schedules to specific day
- Optional - only rendered if callback provided

### 7. Scrollable Container
- Maximum height of 600px
- Custom scrollbar styling
- Smooth scrolling experience

## Styling

### Color Scheme
- **Primary Navy:** #364C84
- **Hover Border:** #364C84
- **Timeline Line:** Linear gradient (blue to purple)
- **Edit Button:** Light blue (#e3f2fd) with blue text (#1976d2)
- **Delete Button:** Light red (#ffebee) with red text (#d32f2f)
- **Travel Info:** Gray gradient with navy accent

### Key Styling Features
- Border radius: 15px (container), 10px (day headers), 8px (items)
- Box shadows for depth
- Smooth transitions (0.3s ease)
- Responsive flexbox layout
- Sticky day headers for better navigation

## Usage Example

```typescript
import React, { useState } from 'react';
import TimelineView from './components/planner/TimelineView';
import { TripData } from './types/planner';

const MyTripPlanner: React.FC = () => {
  const [tripData, setTripData] = useState<TripData>({
    1: [
      {
        time: '09:00',
        location: 'Incheon Airport',
        description: 'Departure from Seoul',
        icon: '✈️',
      },
      {
        time: '14:00',
        location: 'Tokyo Narita',
        description: 'Arrival in Tokyo',
        icon: '🛬',
        travel: {
          time: '3 hours',
          distance: '1,200km',
          method: 'Flight',
        },
      },
    ],
    2: [
      // Day 2 schedules...
    ],
  });

  const handleEdit = (dayNumber: number, itemIndex: number) => {
    console.log(`Editing Day ${dayNumber}, Item ${itemIndex}`);
    // Your edit logic here
  };

  const handleDelete = (dayNumber: number, itemIndex: number) => {
    if (confirm('Delete this schedule?')) {
      // Your delete logic here
    }
  };

  const handleAdd = (dayNumber: number) => {
    console.log(`Adding schedule to Day ${dayNumber}`);
    // Your add logic here
  };

  return (
    <TimelineView
      tripData={tripData}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onAdd={handleAdd}
    />
  );
};
```

## Browser Compatibility

- Modern browsers with CSS Grid and Flexbox support
- Chrome, Firefox, Safari, Edge (latest versions)
- Uses Material-UI components for cross-browser consistency

## Dependencies

- React 18.2+
- @mui/material 5.15+
- @mui/icons-material 5.15+

## Based On

This component is based on the HTML template at:
- File: `/home/playdata/SKN15-FINAL-2TEAM/planner.html`
- Lines: 678-877 (styles), 4189-4274 (structure)

## Notes

- All callback props (onEdit, onDelete, onAdd) are optional
- If callbacks are not provided, corresponding buttons won't be rendered
- Days are automatically sorted by day number
- Empty days are handled gracefully
- Component is fully type-safe with TypeScript
