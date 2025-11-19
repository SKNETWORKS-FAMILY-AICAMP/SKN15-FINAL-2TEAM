# LocationsSidebar - Quick Reference Card

## 5-Second Overview
Fixed sidebar on right side for managing selected travel locations and accommodations with toggle and remove functionality.

## Files Created
```
frontend/src/
├── components/planner/
│   ├── LocationsSidebar.tsx              ← Main component
│   ├── LocationsSidebar.example.tsx      ← Usage example
│   ├── LocationsSidebar.README.md        ← Full documentation
│   ├── LocationsSidebar.STRUCTURE.md     ← Visual structure guide
│   ├── LocationsSidebar.INTEGRATION.md   ← Integration guide
│   └── LocationsSidebar.QUICKREF.md      ← This file
└── styles/
    └── LocationsSidebar.css              ← Component styles
```

## Minimal Usage

```tsx
import LocationsSidebar from './components/planner/LocationsSidebar';

function App() {
  const [locations, setLocations] = useState([]);
  const [accommodations, setAccommodations] = useState([]);

  return (
    <LocationsSidebar
      locations={locations}
      accommodations={accommodations}
      onRemoveLocation={(i) => setLocations(prev => prev.filter((_, idx) => idx !== i))}
      onRemoveAccommodation={(i) => setAccommodations(prev => prev.filter((_, idx) => idx !== i))}
    />
  );
}
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `locations` | `Location[]` | Array of selected locations |
| `accommodations` | `Accommodation[]` | Array of selected accommodations |
| `onRemoveLocation` | `(index: number) => void` | Handler for removing a location |
| `onRemoveAccommodation` | `(index: number) => void` | Handler for removing an accommodation |

## Types

```typescript
interface Location {
  name: string;
  description: string;
  city: string;
  icon?: string;
}

interface Accommodation {
  name: string;
  description: string;
  city: string;
  price: string;
  budget: 'low' | 'mid' | 'high';
  type: string;
}
```

## Key Features

✅ Fixed position (right edge, vertically centered)
✅ Collapsible with toggle button (« / »)
✅ Two sections: "선택한 장소" and "선택한 숙소"
✅ Count badge showing total items
✅ Remove buttons (×) for each item
✅ Smooth slide animation
✅ Scrollable content area
✅ Navy theme (#364C84)
✅ Responsive design

## Dimensions

- **Open Width**: 280px
- **Toggle Width**: 30px
- **Height**: 400px
- **Z-index**: 1000

## Key CSS Classes

```css
.locations-sidebar          /* Main container */
.locations-sidebar.collapsed /* Collapsed state */
.sidebar-toggle             /* Toggle button */
.sidebar-content            /* Content area */
.sidebar-item               /* Individual item */
.sidebar-remove-btn         /* Remove button */
```

## Common Operations

### Add Item
```tsx
// Location
setLocations(prev => [...prev, newLocation]);

// Accommodation
setAccommodations(prev => [...prev, newAccommodation]);
```

### Remove Item
```tsx
// Already handled by component via props
onRemoveLocation={(index) => {/* your logic */}}
onRemoveAccommodation={(index) => {/* your logic */}}
```

### Clear All
```tsx
setLocations([]);
setAccommodations([]);
```

### Get Total Count
```tsx
const total = locations.length + accommodations.length;
```

## Styling Customization

```css
/* Primary color */
.sidebar-toggle,
.sidebar-header h3 {
  background: #364C84;  /* Change to your color */
}

/* Width */
.locations-sidebar {
  width: 280px;  /* Adjust as needed */
}

/* Animation speed */
.locations-sidebar {
  transition: transform 0.3s ease;  /* Adjust timing */
}
```

## Based On

Original HTML: `/home/playdata/SKN15-FINAL-2TEAM/planner.html`
- Lines 2548-2565: Sidebar structure
- Lines 3463-3533: Update logic

## State Management

```tsx
// Simple
const [locations, setLocations] = useState<Location[]>([]);

// With LocalStorage
useEffect(() => {
  const saved = localStorage.getItem('locations');
  if (saved) setLocations(JSON.parse(saved));
}, []);

useEffect(() => {
  localStorage.setItem('locations', JSON.stringify(locations));
}, [locations]);
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Not visible | Check z-index, CSS import, parent overflow |
| Toggle not working | Check onClick handler, state management |
| Items not updating | Use immutable state updates ([...prev]) |
| Animation jerky | Check CSS transitions, GPU acceleration |

## Import Paths

```tsx
import LocationsSidebar from './components/planner/LocationsSidebar';
import { Location, Accommodation } from './types/planner';
import './styles/LocationsSidebar.css';  // If not auto-imported
```

## Accessibility

- ✅ Semantic HTML
- ✅ ARIA labels on buttons
- ✅ Keyboard navigation
- ✅ Focus states
- ✅ Screen reader friendly

## Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ⚠️ IE11 (with polyfills)

## Performance Tips

1. Memoize handlers with `useCallback`
2. Use `React.memo` for component
3. Limit re-renders with proper key usage
4. Debounce auto-save operations

## Next Steps

1. Import component in your planner page
2. Set up state management
3. Implement add/remove handlers
4. Test on different screen sizes
5. Add persistence (localStorage/API)
6. Integrate with search components

## Documentation Files

📄 **README.md** - Complete documentation
📄 **STRUCTURE.md** - Visual structure diagrams
📄 **INTEGRATION.md** - Integration examples
📄 **example.tsx** - Working example
📄 **QUICKREF.md** - This quick reference

## Support

See detailed documentation in:
- `LocationsSidebar.README.md` - Full documentation
- `LocationsSidebar.INTEGRATION.md` - Integration guide
- `LocationsSidebar.example.tsx` - Working example

---

**Created**: 2025-10-13
**Version**: 1.0.0
**Based on**: planner.html lines 2548-2565, 3463-3533
**Project**: SKN15-FINAL-2TEAM
