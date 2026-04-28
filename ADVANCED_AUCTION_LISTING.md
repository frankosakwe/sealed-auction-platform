# Advanced Auction Listing Implementation

## Overview

This document describes the implementation of a paginated auction listing with advanced filtering, search, and sorting capabilities for the Sealed Auction Platform.

## Features Implemented

### 1. Grid/List View Toggle
- Located in the header next to the page title
- Users can switch between grid view (default) and list view
- View preference is preserved via URL parameters
- Smooth CSS transitions between views

### 2. Advanced Filter Sidebar
- **Status Filter**: All, Active, Ending Soon (24h), Closed
- **Category Filter**: Dynamically loaded from database
- **Price Range Filter**: Min and max price inputs with validation
- **Filter Actions**: 
  - Apply Filters button to commit changes
  - Clear All Filters button to reset everything
- Mobile-responsive with toggle button

### 3. Search Bar with Autocomplete
- Real-time search input with debouncing (300ms)
- Autocomplete dropdown with suggestions
- Displays:
  - Auction title
  - Category
  - Current highest bid
- Click suggestions to populate search and load results
- Minimum 2 characters required to show suggestions

### 4. Sort Options
- **Newest First** (default) - by creation date
- **Price: Low to High** - ascending price order
- **Price: High to Low** - descending price order
- **Ending Soon** - auctions ending soonest first
- **Ending Later** - auctions ending latest first
- **Most Popular** - by bid count

### 5. Category Filtering
- Dynamically fetches categories from database
- Radio button selection (single category)
- Includes "All Categories" option

### 6. Status Filters
- **Active**: Currently open auctions
- **Ending Soon**: Auctions ending within 24 hours
- **Closed**: Completed auctions
- **All Status**: No status filter

### 7. Pagination
- Page-based pagination with smart page number display
- Previous/Next buttons
- Shows current page with surrounding pages (±2 pages)
- Ellipsis (...) for skipped pages
- Disabled state for boundary pages
- Scroll to top on page change

### 8. Loading States
- Skeleton loading cards while fetching data
- Animated skeleton loaders (shimmer effect)
- Loading spinner for initial load
- Each card shows placeholder image during load

### 9. URL Parameter Preservation
- All filters are encoded in URL parameters
- Supports direct linking with pre-applied filters
- Parameters include:
  - `page`: Current page number
  - `status`: Active status filter
  - `category`: Selected category
  - `minPrice`: Minimum price filter
  - `maxPrice`: Maximum price filter
  - `search`: Search query
  - `sortBy`: Sort option
  - `view`: Grid or list view
  - `endingSoon`: Whether ending soon filter is active

### 10. Active Filters Display
- Shows applied filters as clickable tags
- Each tag has a remove button (✕)
- Clicking remove clears that specific filter
- Tags update in real-time

### 11. Auction Card Display
Grid view features:
- Auction image (placeholder)
- Status badge (Active/Ending Soon/Closed)
- Title with 2-line truncation
- Description with 2-line truncation
- Category tag
- Bid count and view count
- Current bid price (highlighted)
- Time remaining
- Action button (Place Bid or View Details)

List view features:
- All grid view features
- Larger image and title
- More space for information
- Better for mobile viewing

### 12. Real-Time Features
- Instant search results with autocomplete
- Filters work independently and combined
- Sort updates instantly
- View toggle updates immediately
- No page reload required for any operation

### 13. View Tracking
- Optional view tracking when auction is clicked
- Non-blocking (doesn't affect user experience)
- Tracked via `/api/auctions/:id/views` endpoint

## Backend API Endpoints

### GET /api/auctions/filter/advanced
Advanced filtering and pagination endpoint.

**Query Parameters:**
```
- page (number): Page number (default: 1)
- limit (number): Items per page, max 100 (default: 10)
- status (string): 'all', 'active', 'closed'
- category (string): Category name or 'all'
- minPrice (number): Minimum price
- maxPrice (number): Maximum price
- search (string): Search query
- sortBy (string): 'newest', 'price_asc', 'price_desc', 'time_asc', 'time_desc', 'popularity_desc'
- endingSoon (boolean): Filter for ending soon auctions
```

**Response:**
```json
{
  "auctions": [
    {
      "id": "auction-id",
      "title": "Auction Title",
      "description": "Description",
      "startingBid": 100.00,
      "currentHighestBid": 250.00,
      "endTime": "2026-04-30T12:00:00Z",
      "status": "active",
      "category": "electronics",
      "bidCount": 5,
      "viewCount": 42,
      "creator": "user-id",
      "_links": {
        "self": { "href": "/api/auctions/{id}" },
        "bids": { "href": "/api/auctions/{id}/bids" }
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 12,
    "total": 150,
    "totalPages": 13,
    "hasMore": true
  },
  "filters": {
    "status": "active",
    "category": "electronics",
    ...
  }
}
```

### GET /api/auctions/search/autocomplete
Autocomplete suggestions for search.

**Query Parameters:**
```
- q (string): Search query (minimum 2 characters)
```

**Response:**
```json
{
  "suggestions": [
    {
      "id": "auction-id",
      "title": "Auction Title",
      "category": "electronics",
      "price": 250.00,
      "type": "auction"
    }
  ],
  "query": "search term"
}
```

### GET /api/auctions/categories
Get all available auction categories.

**Response:**
```json
{
  "categories": [
    { "name": "electronics" },
    { "name": "art" },
    { "name": "jewelry" }
  ],
  "_links": {
    "self": { "href": "/api/auctions/categories" }
  }
}
```

### POST /api/auctions/:id/views
Track an auction view.

**Parameters:**
```
- id (path): Auction ID
```

**Response:**
```json
{
  "success": true,
  "viewId": "view-id",
  "_links": {
    "self": { "href": "/api/auctions/{id}" }
  }
}
```

## Database Schema Changes

### New auction_views Table
```sql
CREATE TABLE auction_views (
  id TEXT PRIMARY KEY,
  auction_id TEXT NOT NULL,
  user_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
)
```

### Updated Auctions Table
The auctions table already includes a `category` field used for filtering.

## Database Methods Added

### getFilteredAuctions(page, limit, filters)
Returns paginated and filtered auctions with support for:
- Status filtering
- Category filtering
- Price range filtering
- Search by title/description
- Multiple sort options
- Bid count aggregation
- View count aggregation

### getAuctionCategories()
Returns distinct categories from the auctions table.

### searchAuctions(query, limit)
Returns active auctions matching search query limited by result count.

### recordAuctionView(auctionId, userId, ipAddress, userAgent)
Records an auction view in the database.

### getAuctionViewCount(auctionId)
Returns the view count for a specific auction.

## Frontend Files

### auctions-advanced.html
Main HTML file with:
- Responsive grid layout
- Filter sidebar
- Search bar
- Auction grid container
- Pagination controls
- Mobile-responsive CSS

### auctions-advanced.js
JavaScript module (AdvancedAuctionListing class) handling:
- State management
- API calls
- DOM updates
- Event handling
- URL parameter management
- View switching
- Filter/sort logic
- Search with autocomplete
- Pagination

## Acceptance Criteria Verification

### ✅ Search returns relevant results instantly
- Implemented with autocomplete
- 300ms debounce to prevent excessive requests
- Results show title, category, and price
- Works seamlessly with other filters

### ✅ Filters work independently and combined
- Each filter can be used alone
- Filters work together on the same query
- Multiple filters compound the results
- Clear button resets all filters

### ✅ Sort options update correctly
- 6 sort options available
- Updates results immediately
- Preserves other filters when changing sort
- URL parameter updated

### ✅ Grid/List view toggle works
- Toggle buttons in header
- Smooth CSS transition between views
- View preference preserved in URL
- Different CSS layout for each view

### ✅ Infinite scroll or pagination
- Page-based pagination implemented
- Previous/Next buttons
- Numbered page links
- Smart pagination (shows ±2 pages)
- Scroll to top on page change

### ✅ Loading states for all operations
- Skeleton loaders while fetching
- Shimmer animation effect
- Spinner for initial load
- Empty state message for no results
- Error messages for failed requests

### ✅ URL parameters preserve filter state
- All filters encoded in URL
- Direct linking with filters works
- Back button preserves state
- Refresh page maintains filters

## Usage

### Access the Advanced Listing
Navigate to: `/auctions-advanced.html`

### Example URLs with Filters

```
# All active electronics under $500
/auctions-advanced.html?status=active&category=electronics&maxPrice=500

# Search with sort by price
/auctions-advanced.html?search=vintage&sortBy=price_asc

# Page 3 with filters
/auctions-advanced.html?page=3&status=active&sortBy=newest

# List view with multiple filters
/auctions-advanced.html?view=list&category=art&endingSoon=true&sortBy=time_asc
```

## Performance Optimizations

1. **Debounced Search**: 300ms debounce on search input to reduce API calls
2. **Lazy Loading**: Categories loaded on demand
3. **Efficient Pagination**: SQL LIMIT/OFFSET for database queries
4. **View Tracking**: Non-blocking, fire-and-forget fetch
5. **URL Management**: Client-side state management without full page reload

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES6 JavaScript support required
- CSS Grid and Flexbox support required

## Troubleshooting

### Autocomplete not showing
- Ensure search query is at least 2 characters
- Check browser console for API errors
- Verify `/api/auctions/search/autocomplete` endpoint is working

### Filters not applying
- Check that all input values are valid
- Verify `/api/auctions/filter/advanced` endpoint is working
- Check browser console for errors

### View not switching
- Ensure CSS includes list-view styles
- Check that grid HTML structure is correct
- Verify JavaScript event listeners are bound

### Pagination not working
- Check total page count calculation
- Verify pagination parameters in URL
- Ensure database query returns correct total count

## Future Enhancements

1. Infinite scroll as alternative to pagination
2. Advanced filter presets/saved searches
3. Filter suggestion/popularity
4. Sort by relevance (full-text search)
5. Faceted search with filter counts
6. Recently viewed auctions
7. Similar auctions recommendations
8. Filter by bid activity level
9. Filter by auction duration
10. Export results to CSV

## Testing Checklist

- [ ] Grid view displays auctions correctly
- [ ] List view displays auctions correctly
- [ ] Can toggle between grid and list view
- [ ] Search suggestions appear after 2 characters
- [ ] Selecting a suggestion populates search and filters
- [ ] Status filter works
- [ ] Category filter works
- [ ] Price range filter works
- [ ] Multiple filters work together
- [ ] Clear filters button resets all filters
- [ ] Sort options change order correctly
- [ ] Pagination works (Previous, Next, page numbers)
- [ ] Scrolls to top on page change
- [ ] URL parameters are updated on filter changes
- [ ] Can bookmark/share a filtered link
- [ ] Loading skeleton appears while fetching
- [ ] Empty state shows when no results
- [ ] Error messages appear for failed requests
- [ ] Mobile view is responsive
- [ ] Mobile filter toggle works
- [ ] Autocomplete includes category and price
- [ ] View count displays for auctions
- [ ] Bid count displays for auctions
- [ ] Active filters tags display
- [ ] Can remove individual filters via tags
- [ ] "Ending Soon" badge shows for appropriate auctions
- [ ] Time remaining displays correctly
- [ ] Status badge colors are correct
