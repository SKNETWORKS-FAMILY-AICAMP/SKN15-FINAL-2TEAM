# LocationsSidebar Component Structure

## Visual Layout

```
┌─────────────────────────────────────────────────┐
│                                                 │
│                                  ┌────┐         │
│    Main Content Area             │ «  │  ◄── Toggle Button (30px)
│                                  │    │         │
│                                  │선택 │         │
│                                  │한  │         │
│                                  │장소 │         │
│                                  └────┴─────────┐│
│                                  │ 선택 항목  총 2개││
│                                  ├──────────────┤│
│                                  │              ││
│                                  │ 선택한 장소    ││ ◄── Sidebar (280px)
│                                  │ ┌──────────┐ ││
│                                  │ │에펠탑  [×]│ ││
│                                  │ │파리       │ ││
│                                  │ └──────────┘ ││
│                                  │              ││
│                                  │ 선택한 숙소    ││
│                                  │ ┌──────────┐ ││
│                                  │ │호텔 [×]  │ ││
│                                  │ │150,000원 │ ││
│                                  │ └──────────┘ ││
│                                  └──────────────┘│
└─────────────────────────────────────────────────┘
```

## Collapsed State

```
┌─────────────────────────────────────────────────┐
│                                                 │
│                                  ┌────┐         │
│    Main Content Area             │ »  │         │
│                                  │    │         │
│                                  │선택 │         │
│                                  │한  │         │
│                                  │장소 │         │
│                                  └────┘         │
│                         (Sidebar hidden) ──────►│
│                                                 │
│                                                 │
│                                                 │
│                                                 │
│                                                 │
│                                                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Component Tree

```
LocationsSidebar
├── div.locations-sidebar [collapsed?]
    ├── div.sidebar-toggle (onClick: toggleSidebar)
    │   ├── span.sidebar-toggle-icon (« or »)
    │   └── span.sidebar-toggle-text ("선택한 장소")
    │
    └── div.sidebar-content
        ├── div.sidebar-header
        │   ├── h3 ("선택 항목")
        │   └── div.selected-count
        │       └── span (총 {count}개)
        │
        └── div.sidebar-items (scrollable)
            ├── [if empty]
            │   └── div.empty-sidebar
            │       └── "장소와 숙소를 선택해주세요"
            │
            └── [if has items]
                ├── div.sidebar-section (locations)
                │   ├── h4.section-title ("선택한 장소")
                │   └── div.sidebar-item (for each location)
                │       ├── div.sidebar-item-info
                │       │   ├── div.sidebar-item-name
                │       │   └── div.sidebar-item-detail
                │       └── button.sidebar-remove-btn (×)
                │
                └── div.sidebar-section (accommodations)
                    ├── h4.section-title ("선택한 숙소")
                    └── div.sidebar-item (for each accommodation)
                        ├── div.sidebar-item-info
                        │   ├── div.sidebar-item-name
                        │   └── div.sidebar-item-detail
                        └── button.sidebar-remove-btn (×)
```

## State Management

```
Component State:
├── isCollapsed: boolean (default: false)
│   └── Controls sidebar visibility
│
Props:
├── locations: Location[]
├── accommodations: Accommodation[]
├── onRemoveLocation: (index: number) => void
└── onRemoveAccommodation: (index: number) => void

Computed:
└── totalCount: number (locations.length + accommodations.length)
```

## CSS Classes Hierarchy

```
.locations-sidebar
├── .collapsed (conditional)
├── .sidebar-toggle
│   ├── .sidebar-toggle-icon
│   └── .sidebar-toggle-text
└── .sidebar-content
    ├── .sidebar-header
    │   ├── h3
    │   └── .selected-count
    │       └── span
    └── .sidebar-items
        ├── .empty-sidebar (when empty)
        └── .sidebar-section (when has items)
            ├── .section-title
            └── .sidebar-item
                ├── .sidebar-item-info
                │   ├── .sidebar-item-name
                │   └── .sidebar-item-detail
                └── .sidebar-remove-btn
```

## Positioning Details

```
Position: fixed
Top: 50%
Right: 0
Transform: translateY(-50%)

┌─ Viewport ──────────────────────────────┐
│                                         │
│                                         │ ◄── 50% from top
│                                  ┌─────┐│ ◄── Right: 0
│                                  │Side││
│                                  │bar ││
│                                  └─────┘│
│                                         │
│                                         │
└─────────────────────────────────────────┘

Collapsed Transform: translate(250px, -50%)
- Slides 250px to the right
- Keeps vertical centering with -50%
```

## Dimensions Reference

```
Open State:
├── Sidebar Width: 280px
├── Sidebar Height: 400px
├── Toggle Button Width: 30px
├── Toggle Button Left: -30px
└── Border Radius: 15px 0 0 15px

Collapsed State:
├── Transform: translate(250px, -50%)
├── Visible Toggle Width: 30px
└── Hidden Content: ~250px off-screen

Item Dimensions:
├── Item Padding: 12px
├── Item Border Radius: 8px
├── Remove Button: 24px × 24px (circle)
└── Item Gap: 8px margin-bottom
```

## Animation Timing

```
Transitions:
├── Sidebar slide: 0.3s ease
├── Toggle hover: 0.2s ease
├── Item hover: 0.2s ease
├── Remove button hover: 0.2s ease
└── Remove button active: scale(0.95)
```

## Color Scheme

```
Primary Color (Navy): #364C84
├── Header title
├── Section titles
├── Count badge background
└── Toggle button background

Secondary Colors:
├── White: #FFFFFF (background)
├── Light Gray: #f8f9fa (item background)
├── Border: #e0e0e0
├── Text Gray: #666 (details)
├── Dark Text: #333 (names)
├── Empty Text: #999
└── Remove Button: #f44336 (red)

Hover States:
├── Toggle: #2a3d6b (darker navy)
├── Item Border: #364C84
├── Remove Button: #d32f2f (darker red)
└── Scrollbar Thumb: #2a3d6b
```

## Responsive Breakpoints

```
Desktop (> 768px):
└── Width: 280px, Height: 400px

Tablet (≤ 768px):
└── Width: 260px, Height: 350px

Mobile (≤ 480px):
└── Width: 240px, Height: 300px
```

## Event Flow

```
User Actions:
1. Click Toggle Button
   ├── toggleSidebar()
   ├── setIsCollapsed(!isCollapsed)
   └── CSS transition applies

2. Click Remove Location
   ├── onRemoveLocation(index)
   └── Parent updates state

3. Click Remove Accommodation
   ├── onRemoveAccommodation(index)
   └── Parent updates state

Auto-Updates:
├── totalCount recalculates on prop changes
└── Items re-render on array changes
```

## Data Flow

```
Parent Component
├── Manages locations[] state
├── Manages accommodations[] state
└── Provides remove handlers
    │
    ▼
LocationsSidebar (Props)
├── Receives locations[]
├── Receives accommodations[]
├── Receives onRemoveLocation
└── Receives onRemoveAccommodation
    │
    ▼
Render Logic
├── Maps locations → sidebar items
├── Maps accommodations → sidebar items
├── Computes totalCount
└── Handles toggle state
    │
    ▼
User Interaction
├── Click remove → calls handler
├── Parent updates state
└── Component re-renders
```
