# Advanced Auction Listing - Testing Guide

## Quick Start Testing

### 1. Access the Feature
Navigate to: `http://localhost:3000/auctions-advanced.html`

### 2. Basic Functionality Tests

#### Test 2.1: Grid/List View Toggle
1. Page loads in grid view (default)
2. Click "List" button in header
3. ✅ View switches to list layout
4. Click "Grid" button
5. ✅ View switches back to grid layout
6. Refresh page
7. ✅ View preference is restored from URL

#### Test 2.2: Search Bar
1. Click search input field
2. Type "v" (single character)
3. ✅ No autocomplete dropdown appears
4. Type "i" (now "vi")
5. ✅ Autocomplete dropdown appears with suggestions
6. Verify suggestions show:
   - Auction title
   - Category (e.g., "electronics", "art")
   - Current bid price
7. Click on a suggestion
8. ✅ Search field populates with title
9. ✅ Auctions list updates immediately
10. ✅ URL parameter includes `search=...`

#### Test 2.3: Status Filter
1. Sidebar on left shows status options
2. Select "Active" radio button
3. Click "Apply Filters"
4. ✅ Results update to show only active auctions
5. Verify URL includes `status=active`
6. Select "Ending Soon"
7. Click "Apply Filters"
8. ✅ Results show auctions ending within 24 hours
9. Select "All Status"
10. Click "Apply Filters"
11. ✅ Results show all statuses

#### Test 2.4: Category Filter
1. Find category section in sidebar
2. Verify categories are dynamically loaded
3. Select a category (e.g., "electronics")
4. Click "Apply Filters"
5. ✅ Results show only that category
6. ✅ URL includes `category=electronics`
7. Select "All Categories"
8. Click "Apply Filters"
9. ✅ Results show all categories

#### Test 2.5: Price Range Filter
1. Find price range inputs in sidebar
2. Enter min price: 100
3. Enter max price: 500
4. Click "Apply Filters"
5. ✅ Results show only auctions between $100-$500
6. ✅ URL includes `minPrice=100&maxPrice=500`
7. Clear max price field
8. Click "Apply Filters"
9. ✅ Results show auctions >= $100
10. Clear min price field
11. Click "Apply Filters"
12. ✅ Results show all prices

#### Test 2.6: Combined Filters
1. Set Status to "Active"
2. Set Category to "electronics"
3. Set Price range: $50-$1000
4. Click "Apply Filters"
5. ✅ Results match ALL criteria
6. ✅ Active filters tags appear below toolbar
7. Each tag shows applied filter

#### Test 2.7: Remove Individual Filters
1. With multiple filters applied
2. Click X on one filter tag
3. ✅ That filter removes but others remain
4. URL updates accordingly
5. Results update to reflect remaining filters

#### Test 2.8: Clear All Filters
1. Apply multiple filters
2. Click "Clear All Filters" button
3. ✅ All filter inputs reset
4. ✅ All active filter tags disappear
5. ✅ Results reset to show all auctions
6. ✅ URL parameters clear

#### Test 2.9: Sort Options
1. Open sort dropdown in toolbar
2. Select "Price: Low to High"
3. ✅ Results update instantly
4. ✅ Auctions sorted by price ascending
5. ✅ URL includes `sortBy=price_asc`
6. Select "Price: High to Low"
7. ✅ Results sorted descending
8. Select "Most Popular"
9. ✅ Results sorted by bid count (descending)
10. Select "Ending Soon"
11. ✅ Results sorted by end time (ascending)
12. Test all 6 sort options

#### Test 2.10: Pagination
1. Results page shows pagination at bottom
2. Current page button highlighted
3. Click next page button
4. ✅ Results change to show next page
5. ✅ URL updates with `page=2`
6. ✅ Page scrolls to top
7. Click on page "3"
8. ✅ Results show page 3
9. Click "Previous" button
10. ✅ Back to page 2
11. Verify first/last page buttons disabled appropriately

#### Test 2.11: URL Parameters Preservation
1. Apply filters: status=active, category=art, sortBy=price_asc
2. Copy current URL
3. Open new browser tab
4. Paste URL into address bar
5. ✅ Page loads with same filters applied
6. ✅ Results match the filtered criteria
7. Click browser back button
8. ✅ Previous page state restored

#### Test 2.12: Direct URL Linking
1. Manually construct URL:
   `/auctions-advanced.html?status=active&category=electronics&maxPrice=500&sortBy=price_asc`
2. Navigate to this URL
3. ✅ Page loads with these filters pre-applied
4. ✅ Results reflect all filters
5. ✅ Filter UI shows selected values

#### Test 2.13: Search with Filters Combined
1. Enter search term
2. Click "Apply Filters"
3. Select a status filter
4. Click "Apply Filters"
5. Change sort option
6. ✅ Results match search AND status AND sort
7. ✅ URL includes all parameters
8. ✅ All active filters display as tags

#### Test 2.14: Auction Card Display
1. Verify each card shows:
   - ✅ Category tag (colorful background)
   - ✅ Auction title (2-line max)
   - ✅ Description (2-line max)
   - ✅ Bid count (💰 X bids)
   - ✅ View count (👁️ X views)
   - ✅ Current bid price (large, prominent)
   - ✅ Time remaining (e.g., "2d 5h remaining")
   - ✅ Status badge (color-coded)
   - ✅ Action button

#### Test 2.15: Status Badges
1. Filter for "Active" auctions
2. ✅ Cards show green "ACTIVE" badge
3. Filter for "Ending Soon"
4. ✅ Cards show orange "ENDING SOON" badge
5. Include closed auctions
6. ✅ Cards show gray "CLOSED" badge

#### Test 2.16: Loading States
1. Perform a search
2. ✅ Skeleton loaders appear while fetching
3. ✅ Shimmer animation plays on skeletons
4. ✅ Results load and replace skeletons
5. Change to list view
6. ✅ Skeleton layout matches list view
7. Apply multiple filters
8. ✅ Loading state appears during fetch

#### Test 2.17: Empty State
1. Enter search term that matches nothing
2. ✅ Empty state message appears
3. Icon and helpful text display
4. ✅ "Try adjusting your filters"

#### Test 2.18: Results Count
1. Toolbar shows "Showing X results"
2. Change filters
3. ✅ Count updates correctly
4. 0 results shows empty state

#### Test 2.19: Mobile Responsiveness
1. Open page on mobile device or use mobile view
2. ✅ Grid changes to single column
3. ✅ Sidebar collapses
4. ✅ "☰ Filters" toggle button appears
5. Click filters toggle
6. ✅ Filter sidebar slides in as full-screen overlay
7. Apply filters
8. ✅ Sidebar closes automatically
9. ✅ Layout adjusts for touch interactions

#### Test 2.20: Mobile Filter Toggle
1. On mobile view
2. ✅ Filters button visible
3. Click button
4. ✅ Dark overlay appears
5. ✅ Filter sidebar appears
6. Modify filter
7. Click "Apply Filters"
8. ✅ Sidebar automatically closes
9. Click filters button again
10. ✅ Sidebar appears with same filters

### 3. Performance Tests

#### Test 3.1: API Response Time
1. Open browser DevTools (F12)
2. Go to Network tab
3. Load the advanced listing page
4. ✅ `/api/auctions/filter/advanced` completes in < 500ms
5. ✅ `/api/auctions/categories` completes in < 200ms
6. ✅ `/api/auctions/search/autocomplete` completes in < 300ms

#### Test 3.2: Autocomplete Performance
1. Type in search field
2. Wait for debounce (300ms)
3. ✅ Suggestions appear quickly (< 300ms total)
4. No lag or stuttering during typing

#### Test 3.3: Filter Application
1. Apply filter with many results
2. ✅ Update appears within 500ms
3. No page freeze or lag

### 4. Edge Cases & Error Handling

#### Test 4.1: Invalid Filter Values
1. Manually set negative price: `?minPrice=-100`
2. ✅ Page loads, filter shows as invalid or defaults
3. Set maxPrice < minPrice
4. ✅ No results or handled gracefully

#### Test 4.2: Empty Search Results
1. Search for term that exists in no auctions
2. ✅ Empty state shows
3. "Try adjusting your filters" message appears

#### Test 4.3: Page Beyond Max
1. Navigate to `?page=9999`
2. ✅ Page either shows last page or no results
3. No crash or error

#### Test 4.4: Network Error Handling
1. Open DevTools Network tab
2. Throttle to "Offline"
3. Try to load page
4. ✅ Error message appears
5. Restore network
6. Try again
7. ✅ Page loads correctly

#### Test 4.5: Multiple Rapid Clicks
1. Rapidly click sort options
2. ✅ UI remains responsive
3. Last click's sort option wins
4. No duplicate requests

#### Test 4.6: Many Active Filters
1. Apply 5+ filters simultaneously
2. ✅ All display as tags
3. ✅ URL remains readable
4. ✅ Results correctly filtered

### 5. Browser Compatibility Tests

Test on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

For each browser:
- [ ] All filters work
- [ ] Search works
- [ ] Sort works
- [ ] Pagination works
- [ ] View toggle works
- [ ] Responsive design works

### 6. Accessibility Tests

#### Test 6.1: Keyboard Navigation
1. Press Tab repeatedly
2. ✅ Can reach all interactive elements
3. ✅ Focus visible on each element
4. ✅ Button labels readable

#### Test 6.2: Screen Reader
1. Use screen reader (e.g., NVDA, JAWS)
2. ✅ Labels are read correctly
3. ✅ Button purposes are clear
4. ✅ Filter names are descriptive

#### Test 6.3: Color Contrast
1. Use contrast checker tool
2. ✅ All text meets WCAG AA standards
3. ✅ Status badges have sufficient contrast

### 7. Data Verification Tests

#### Test 7.1: Correct Auction Display
1. Filter for specific category
2. ✅ All displayed auctions have that category
3. Filter by price range
4. ✅ All prices fall within range
5. Filter by status
6. ✅ All statuses match

#### Test 7.2: Sort Order Verification
1. Sort by price ascending
2. Verify first item <= second item <= third item...
3. ✅ Order is correct
4. Sort by popularity (bid count)
5. ✅ Bid counts are descending

#### Test 7.3: Pagination Correctness
1. Page 1 shows items 1-12 (assuming 12 per page)
2. Page 2 shows items 13-24
3. ✅ No overlap
4. ✅ No missing items

#### Test 7.4: Results Count Accuracy
1. Apply filter
2. Count shown = actual items displayed
3. ✅ Total count matches pagination total
4. ✅ "hasMore" flag is accurate

### 8. User Experience Tests

#### Test 8.1: Intuitive Navigation
1. First-time user can:
   - [ ] Find search bar
   - [ ] Find filter sidebar
   - [ ] Apply filters
   - [ ] View results
   - [ ] Change page
   - Without instructions

#### Test 8.2: Filter Discovery
1. User immediately sees:
   - [ ] Status filter options
   - [ ] Category options
   - [ ] Price range inputs
   - [ ] Apply/Clear buttons

#### Test 8.3: Feedback for Actions
1. When filter is applied:
   - [ ] Results update visibly
   - [ ] URL changes
   - [ ] Active filters show as tags
   - [ ] User knows action succeeded

#### Test 8.4: Error Messages
1. All errors have:
   - [ ] Clear, non-technical language
   - [ ] Suggestion for recovery
   - [ ] Appropriate visual styling

## Test Result Summary Template

```
Test Case: [Name]
Expected: [What should happen]
Actual: [What actually happened]
Status: [PASS/FAIL]
Notes: [Any additional info]
```

## Automated Testing Script

```javascript
// Run in browser console on /auctions-advanced.html
async function runTests() {
  const tests = [];
  
  // Test 1: Check API endpoints exist
  try {
    const response = await fetch('/api/auctions/categories');
    tests.push({ name: 'Categories API', status: response.ok ? 'PASS' : 'FAIL' });
  } catch (e) {
    tests.push({ name: 'Categories API', status: 'FAIL', error: e.message });
  }

  // Test 2: Check filter sidebar exists
  const sidebar = document.getElementById('filterSidebar');
  tests.push({ name: 'Filter Sidebar', status: sidebar ? 'PASS' : 'FAIL' });

  // Test 3: Check search input exists
  const search = document.getElementById('searchInput');
  tests.push({ name: 'Search Input', status: search ? 'PASS' : 'FAIL' });

  // Test 4: Check auction grid exists
  const grid = document.getElementById('auctionGrid');
  tests.push({ name: 'Auction Grid', status: grid ? 'PASS' : 'FAIL' });

  // Test 5: Check pagination exists
  const pagination = document.getElementById('pagination');
  tests.push({ name: 'Pagination', status: pagination ? 'PASS' : 'FAIL' });

  // Print results
  console.table(tests);
}

runTests();
```

## Sign-Off Checklist

When all tests pass, verify:

- [ ] All 20+ manual tests pass
- [ ] No console errors
- [ ] Page loads in < 3 seconds
- [ ] Filters apply in < 500ms
- [ ] All acceptance criteria met
- [ ] Mobile view works
- [ ] URL parameters work
- [ ] No broken links
- [ ] Images load correctly
- [ ] CSS displays correctly

## Known Limitations

1. Placeholder auction images (can be replaced with real URLs)
2. View tracking is non-blocking (may fail silently)
3. Search limited to title and description fields
4. Category data depends on database population
5. Maximum 100 items per page (API limit)

## Notes for Production

Before deploying to production:

1. [ ] Replace placeholder image URLs with real asset URLs
2. [ ] Configure rate limiting appropriately
3. [ ] Add database indexes for filter queries
4. [ ] Set up analytics for filter/search usage
5. [ ] Configure CDN for static assets
6. [ ] Test with production database volume
7. [ ] Set up monitoring for API endpoints
8. [ ] Configure error tracking (e.g., Sentry)
9. [ ] Add authentication if needed
10. [ ] Set up cache headers appropriately
