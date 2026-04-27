class BookmarkManager {
    constructor() {
        this.bookmarks = [];
        this.folders = [];
        this.tags = [];
        this.currentFolder = null;
        this.currentFilter = 'all';
        this.currentSort = 'created_desc';
        this.viewMode = 'grid';
        this.searchQuery = '';
        this.selectedTags = [];
        this.editingBookmark = null;
        this.editingFolder = null;
        this.deviceId = this.generateDeviceId();
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadBookmarks();
        this.startAutoSync();
    }
    
    generateDeviceId() {
        let deviceId = localStorage.getItem('bookmark_device_id');
        if (!deviceId) {
            deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('bookmark_device_id', deviceId);
        }
        return deviceId;
    }
    
    setupEventListeners() {
        // Navigation and UI
        document.getElementById('sidebarToggle').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('addBookmarkBtn').addEventListener('click', () => this.openBookmarkModal());
        document.getElementById('addFolderBtn').addEventListener('click', () => this.openFolderModal());
        document.getElementById('emptyAddBookmarkBtn').addEventListener('click', () => this.openBookmarkModal());
        
        // Import/Export
        document.getElementById('importExportBtn').addEventListener('click', () => this.toggleImportExportMenu());
        document.getElementById('importBtn').addEventListener('click', () => this.openImportModal());
        document.getElementById('exportJsonBtn').addEventListener('click', () => this.exportBookmarks('json'));
        document.getElementById('exportCsvBtn').addEventListener('click', () => this.exportBookmarks('csv'));
        
        // Sync
        document.getElementById('syncBtn').addEventListener('click', () => this.syncBookmarks());
        
        // Search and filters
        document.getElementById('searchInput').addEventListener('input', (e) => this.handleSearch(e.target.value));
        document.getElementById('sortSelect').addEventListener('change', (e) => this.handleSort(e.target.value));
        
        // View modes
        document.getElementById('gridViewBtn').addEventListener('click', () => this.setViewMode('grid'));
        document.getElementById('listViewBtn').addEventListener('click', () => this.setViewMode('list'));
        
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => this.applyFilter(btn.dataset.filter));
        });
        
        // Bookmark form
        document.getElementById('bookmarkForm').addEventListener('submit', (e) => this.handleBookmarkSubmit(e));
        document.getElementById('addTagBtn').addEventListener('click', () => this.addTag());
        document.getElementById('tagInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addTag();
            }
        });
        
        // Folder form
        document.getElementById('folderForm').addEventListener('submit', (e) => this.handleFolderSubmit(e));
        
        // Color selection
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', () => this.selectFolderColor(btn.dataset.color));
        });
        
        // Import
        document.getElementById('importFile').addEventListener('change', (e) => this.handleImportFile(e));
        
        // Click outside to close menus
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#importExportBtn') && !e.target.closest('#importExportMenu')) {
                document.getElementById('importExportMenu').classList.add('hidden');
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'b':
                        e.preventDefault();
                        this.openBookmarkModal();
                        break;
                    case 'f':
                        e.preventDefault();
                        document.getElementById('searchInput').focus();
                        break;
                    case 's':
                        e.preventDefault();
                        this.syncBookmarks();
                        break;
                }
            }
        });
    }
    
    async loadBookmarks() {
        this.showLoading();
        try {
            const response = await fetch('/api/bookmarks');
            const data = await response.json();
            
            if (data.success) {
                this.bookmarks = data.data.bookmarks || [];
                this.folders = data.data.folders || [];
                this.tags = data.data.tags || [];
                
                this.renderFolders();
                this.renderTags();
                this.renderBookmarks();
            } else {
                this.showToast('Failed to load bookmarks', 'error');
            }
        } catch (error) {
            console.error('Error loading bookmarks:', error);
            this.showToast('Network error loading bookmarks', 'error');
        } finally {
            this.hideLoading();
        }
    }
    
    renderFolders() {
        const folderList = document.getElementById('folderList');
        const bookmarkFolderSelect = document.getElementById('bookmarkFolder');
        const parentFolderSelect = document.getElementById('parentFolder');
        
        // Clear existing content
        folderList.innerHTML = '';
        bookmarkFolderSelect.innerHTML = '<option value="">No Folder</option>';
        parentFolderSelect.innerHTML = '<option value="">Root Level</option>';
        
        // Add "All Bookmarks" folder
        const allBookmarksItem = this.createFolderItem({
            id: null,
            name: 'All Bookmarks',
            color: '#6b7280',
            icon: 'folder-open'
        });
        folderList.appendChild(allBookmarksItem);
        
        // Render folder tree
        const rootFolders = this.folders.filter(f => !f.parent_folder_id);
        rootFolders.forEach(folder => {
            const folderElement = this.renderFolderTree(folder, folderList);
            bookmarkFolderSelect.appendChild(new Option(folder.name, folder.id));
            parentFolderSelect.appendChild(new Option(folder.name, folder.id));
        });
        
        // Update folder selects with indentation for nested folders
        this.updateFolderSelects();
    }
    
    renderFolderTree(folder, parentElement) {
        const folderElement = this.createFolderItem(folder);
        parentElement.appendChild(folderElement);
        
        const childFolders = this.folders.filter(f => f.parent_folder_id === folder.id);
        if (childFolders.length > 0) {
            const childList = document.createElement('ul');
            childFolders.forEach(childFolder => {
                this.renderFolderTree(childFolder, childList);
            });
            folderElement.appendChild(childList);
        }
        
        return folderElement;
    }
    
    createFolderItem(folder) {
        const li = document.createElement('li');
        li.className = 'folder-item';
        if (this.currentFolder === folder.id) {
            li.classList.add('active');
        }
        
        li.innerHTML = `
            <i class="fas fa-${folder.icon || 'folder'} mr-2" style="color: ${folder.color || '#3b82f6'}"></i>
            <span class="flex-1">${folder.name}</span>
            ${folder.id ? `<span class="folder-count text-xs text-gray-500">${this.getFolderBookmarkCount(folder.id)}</span>` : ''}
        `;
        
        li.addEventListener('click', () => this.selectFolder(folder.id));
        
        if (folder.id) {
            // Add context menu for folders
            li.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showFolderContextMenu(e, folder);
            });
        }
        
        return li;
    }
    
    getFolderBookmarkCount(folderId) {
        if (!folderId) return this.bookmarks.length;
        return this.bookmarks.filter(b => b.folder_id === folderId).length;
    }
    
    updateFolderSelects() {
        const bookmarkFolderSelect = document.getElementById('bookmarkFolder');
        const parentFolderSelect = document.getElementById('parentFolder');
        
        // Clear and rebuild with proper indentation
        const buildFolderOptions = (folders, parentId = null, level = 0) => {
            const options = [];
            const children = folders.filter(f => f.parent_folder_id === parentId);
            
            children.forEach(folder => {
                const indent = '　'.repeat(level);
                options.push(new Option(`${indent}${folder.name}`, folder.id));
                options.push(...buildFolderOptions(folders, folder.id, level + 1));
            });
            
            return options;
        };
        
        const options = buildFolderOptions(this.folders);
        bookmarkFolderSelect.innerHTML = '<option value="">No Folder</option>';
        parentFolderSelect.innerHTML = '<option value="">Root Level</option>';
        
        options.forEach(option => {
            bookmarkFolderSelect.appendChild(option.cloneNode(true));
            parentFolderSelect.appendChild(option);
        });
    }
    
    renderTags() {
        const tagCloud = document.getElementById('tagCloud');
        tagCloud.innerHTML = '';
        
        this.tags.forEach(tag => {
            const tagElement = document.createElement('button');
            tagElement.className = 'tag-badge';
            tagElement.style.backgroundColor = tag.color + '20';
            tagElement.style.color = tag.color;
            tagElement.innerHTML = `
                ${tag.name}
                <span class="ml-1 text-xs">${tag.usage_count || 0}</span>
            `;
            
            tagElement.addEventListener('click', () => this.toggleTagFilter(tag.name));
            tagCloud.appendChild(tagElement);
        });
    }
    
    renderBookmarks() {
        const container = document.getElementById('bookmarksContainer');
        const emptyState = document.getElementById('emptyState');
        const bookmarkCount = document.getElementById('bookmarkCount');
        
        // Filter bookmarks
        let filteredBookmarks = this.filterBookmarks();
        
        // Sort bookmarks
        filteredBookmarks = this.sortBookmarks(filteredBookmarks);
        
        // Update count
        bookmarkCount.textContent = filteredBookmarks.length;
        
        // Show/hide empty state
        if (filteredBookmarks.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }
        
        container.style.display = '';
        emptyState.style.display = 'none';
        
        // Set grid class based on view mode
        if (this.viewMode === 'grid') {
            container.className = 'bookmark-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
        } else {
            container.className = 'space-y-2';
        }
        
        // Render bookmarks
        container.innerHTML = '';
        filteredBookmarks.forEach(bookmark => {
            const bookmarkElement = this.createBookmarkElement(bookmark);
            container.appendChild(bookmarkElement);
        });
        
        // Make container sortable
        if (this.viewMode === 'grid') {
            new Sortable(container, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                dragClass: 'sortable-drag',
                onEnd: (evt) => this.handleBookmarkReorder(evt)
            });
        }
    }
    
    createBookmarkElement(bookmark) {
        if (this.viewMode === 'grid') {
            return this.createBookmarkCard(bookmark);
        } else {
            return this.createBookmarkListItem(bookmark);
        }
    }
    
    createBookmarkCard(bookmark) {
        const div = document.createElement('div');
        div.className = 'bookmark-card bg-white rounded-lg shadow-md p-4';
        div.dataset.bookmarkId = bookmark.id;
        
        const favicon = bookmark.favicon ? `<img src="${bookmark.favicon}" class="w-6 h-6 mr-2" onerror="this.style.display='none'">` : '';
        const thumbnail = bookmark.thumbnail ? `<img src="${bookmark.thumbnail}" class="w-full h-32 object-cover rounded mb-3" onerror="this.style.display='none'">` : '';
        
        div.innerHTML = `
            ${thumbnail}
            <div class="flex items-start justify-between mb-2">
                <div class="flex items-center flex-1 min-w-0">
                    ${favicon}
                    <h3 class="text-lg font-medium text-gray-900 truncate">${bookmark.title}</h3>
                    ${bookmark.is_favorite ? '<i class="fas fa-star text-yellow-500 ml-2"></i>' : ''}
                </div>
                <div class="flex space-x-1">
                    <button class="edit-bookmark p-1 text-gray-400 hover:text-blue-600" onclick="bookmarkManager.editBookmark('${bookmark.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-bookmark p-1 text-gray-400 hover:text-red-600" onclick="bookmarkManager.deleteBookmark('${bookmark.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            
            ${bookmark.description ? `<p class="text-sm text-gray-600 mb-2 line-clamp-2">${bookmark.description}</p>` : ''}
            
            <div class="text-sm text-blue-600 hover:text-blue-800 mb-2 truncate">
                <i class="fas fa-link mr-1"></i>
                <a href="${bookmark.url}" target="_blank" class="hover:underline">${bookmark.url}</a>
            </div>
            
            ${bookmark.tags && bookmark.tags.length > 0 ? `
                <div class="flex flex-wrap gap-1 mb-2">
                    ${bookmark.tags.map(tag => `
                        <span class="tag-badge text-xs" style="background-color: ${this.getTagColor(tag)}20; color: ${this.getTagColor(tag)}">
                            ${tag}
                        </span>
                    `).join('')}
                </div>
            ` : ''}
            
            <div class="flex items-center justify-between text-xs text-gray-500">
                <span><i class="fas fa-folder mr-1"></i>${bookmark.folder_name || 'No Folder'}</span>
                <span>${this.formatDate(bookmark.created_at)}</span>
            </div>
        `;
        
        return div;
    }
    
    createBookmarkListItem(bookmark) {
        const div = document.createElement('div');
        div.className = 'bg-white rounded-lg shadow p-4 flex items-center justify-between';
        div.dataset.bookmarkId = bookmark.id;
        
        const favicon = bookmark.favicon ? `<img src="${bookmark.favicon}" class="w-5 h-5 mr-2" onerror="this.style.display='none'">` : '';
        
        div.innerHTML = `
            <div class="flex items-center flex-1 min-w-0">
                ${favicon}
                <div class="flex-1 min-w-0">
                    <div class="flex items-center">
                        <h3 class="text-lg font-medium text-gray-900 truncate">${bookmark.title}</h3>
                        ${bookmark.is_favorite ? '<i class="fas fa-star text-yellow-500 ml-2"></i>' : ''}
                    </div>
                    <div class="text-sm text-blue-600 hover:text-blue-800 truncate">
                        <a href="${bookmark.url}" target="_blank" class="hover:underline">${bookmark.url}</a>
                    </div>
                    ${bookmark.description ? `<p class="text-sm text-gray-600 truncate">${bookmark.description}</p>` : ''}
                    ${bookmark.tags && bookmark.tags.length > 0 ? `
                        <div class="flex flex-wrap gap-1 mt-1">
                            ${bookmark.tags.map(tag => `
                                <span class="tag-badge text-xs" style="background-color: ${this.getTagColor(tag)}20; color: ${this.getTagColor(tag)}">
                                    ${tag}
                                </span>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="flex items-center space-x-2 ml-4">
                <span class="text-xs text-gray-500">${bookmark.folder_name || 'No Folder'}</span>
                <button class="edit-bookmark p-1 text-gray-400 hover:text-blue-600" onclick="bookmarkManager.editBookmark('${bookmark.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="delete-bookmark p-1 text-gray-400 hover:text-red-600" onclick="bookmarkManager.deleteBookmark('${bookmark.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        return div;
    }
    
    filterBookmarks() {
        let filtered = [...this.bookmarks];
        
        // Folder filter
        if (this.currentFilter === 'folder' && this.currentFolder) {
            filtered = filtered.filter(b => b.folder_id === this.currentFolder);
        }
        
        // Quick filters
        if (this.currentFilter === 'favorites') {
            filtered = filtered.filter(b => b.is_favorite);
        } else if (this.currentFilter === 'recent') {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            filtered = filtered.filter(b => new Date(b.created_at) > sevenDaysAgo);
        }
        
        // Search filter
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(b => 
                b.title.toLowerCase().includes(query) ||
                (b.description && b.description.toLowerCase().includes(query)) ||
                b.url.toLowerCase().includes(query) ||
                (b.tags && b.tags.some(tag => tag.toLowerCase().includes(query)))
            );
        }
        
        // Tag filter
        if (this.selectedTags.length > 0) {
            filtered = filtered.filter(b => 
                b.tags && this.selectedTags.every(tag => b.tags.includes(tag))
            );
        }
        
        return filtered;
    }
    
    sortBookmarks(bookmarks) {
        switch (this.currentSort) {
            case 'created_desc':
                return bookmarks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            case 'created_asc':
                return bookmarks.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            case 'title_asc':
                return bookmarks.sort((a, b) => a.title.localeCompare(b.title));
            case 'title_desc':
                return bookmarks.sort((a, b) => b.title.localeCompare(a.title));
            case 'url_asc':
                return bookmarks.sort((a, b) => a.url.localeCompare(b.url));
            default:
                return bookmarks;
        }
    }
    
    openBookmarkModal(bookmark = null) {
        this.editingBookmark = bookmark;
        const modal = document.getElementById('bookmarkModal');
        const title = document.getElementById('bookmarkModalTitle');
        const form = document.getElementById('bookmarkForm');
        
        if (bookmark) {
            title.textContent = 'Edit Bookmark';
            form.title.value = bookmark.title;
            form.url.value = bookmark.url;
            form.description.value = bookmark.description || '';
            form.folder.value = bookmark.folder_id || '';
            form.favorite.checked = bookmark.is_favorite;
            form.private.checked = bookmark.is_private;
            
            // Set tags
            this.selectedTags = bookmark.tags || [];
            this.renderSelectedTags();
        } else {
            title.textContent = 'Add Bookmark';
            form.reset();
            this.selectedTags = [];
            this.renderSelectedTags();
        }
        
        modal.classList.remove('hidden');
    }
    
    closeBookmarkModal() {
        document.getElementById('bookmarkModal').classList.add('hidden');
        this.editingBookmark = null;
    }
    
    async handleBookmarkSubmit(e) {
        e.preventDefault();
        
        const form = e.target;
        const bookmarkData = {
            title: form.title.value,
            url: form.url.value,
            description: form.description.value,
            folder_id: form.folder.value || null,
            is_favorite: form.favorite.checked,
            is_private: form.private.checked,
            tags: this.selectedTags
        };
        
        try {
            let response;
            if (this.editingBookmark) {
                response = await fetch(`/api/bookmarks/${this.editingBookmark.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bookmarkData)
                });
            } else {
                response = await fetch('/api/bookmarks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bookmarkData)
                });
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast(this.editingBookmark ? 'Bookmark updated' : 'Bookmark created', 'success');
                this.closeBookmarkModal();
                this.loadBookmarks();
            } else {
                this.showToast(result.error || 'Failed to save bookmark', 'error');
            }
        } catch (error) {
            console.error('Error saving bookmark:', error);
            this.showToast('Network error saving bookmark', 'error');
        }
    }
    
    async editBookmark(bookmarkId) {
        const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
        if (bookmark) {
            this.openBookmarkModal(bookmark);
        }
    }
    
    async deleteBookmark(bookmarkId) {
        if (!confirm('Are you sure you want to delete this bookmark?')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/bookmarks/${bookmarkId}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast('Bookmark deleted', 'success');
                this.loadBookmarks();
            } else {
                this.showToast(result.error || 'Failed to delete bookmark', 'error');
            }
        } catch (error) {
            console.error('Error deleting bookmark:', error);
            this.showToast('Network error deleting bookmark', 'error');
        }
    }
    
    openFolderModal(folder = null) {
        this.editingFolder = folder;
        const modal = document.getElementById('folderModal');
        const form = document.getElementById('folderForm');
        
        if (folder) {
            form.name.value = folder.name;
            form.description.value = folder.description || '';
            form.parentFolder.value = folder.parent_folder_id || '';
            this.selectFolderColor(folder.color || '#3b82f6');
        } else {
            form.reset();
            this.selectFolderColor('#3b82f6');
        }
        
        modal.classList.remove('hidden');
    }
    
    closeFolderModal() {
        document.getElementById('folderModal').classList.add('hidden');
        this.editingFolder = null;
    }
    
    async handleFolderSubmit(e) {
        e.preventDefault();
        
        const form = e.target;
        const folderData = {
            name: form.name.value,
            description: form.description.value,
            parent_folder_id: form.parentFolder.value || null,
            color: this.selectedFolderColor || '#3b82f6'
        };
        
        try {
            let response;
            if (this.editingFolder) {
                response = await fetch(`/api/bookmarks/folders/${this.editingFolder.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(folderData)
                });
            } else {
                response = await fetch('/api/bookmarks/folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(folderData)
                });
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast(this.editingFolder ? 'Folder updated' : 'Folder created', 'success');
                this.closeFolderModal();
                this.loadBookmarks();
            } else {
                this.showToast(result.error || 'Failed to save folder', 'error');
            }
        } catch (error) {
            console.error('Error saving folder:', error);
            this.showToast('Network error saving folder', 'error');
        }
    }
    
    selectFolderColor(color) {
        this.selectedFolderColor = color;
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.classList.remove('ring-2', 'ring-offset-2', 'ring-blue-500');
        });
        document.querySelector(`.color-btn[data-color="${color}"]`).classList.add('ring-2', 'ring-offset-2', 'ring-blue-500');
    }
    
    addTag() {
        const input = document.getElementById('tagInput');
        const tag = input.value.trim();
        
        if (tag && !this.selectedTags.includes(tag)) {
            this.selectedTags.push(tag);
            this.renderSelectedTags();
            input.value = '';
        }
    }
    
    renderSelectedTags() {
        const container = document.getElementById('selectedTags');
        container.innerHTML = this.selectedTags.map(tag => `
            <span class="tag-badge" style="background-color: ${this.getTagColor(tag)}20; color: ${this.getTagColor(tag)}">
                ${tag}
                <button type="button" onclick="bookmarkManager.removeTag('${tag}')" class="ml-1">
                    <i class="fas fa-times text-xs"></i>
                </button>
            </span>
        `).join('');
    }
    
    removeTag(tag) {
        this.selectedTags = this.selectedTags.filter(t => t !== tag);
        this.renderSelectedTags();
    }
    
    getTagColor(tagName) {
        const tag = this.tags.find(t => t.name === tagName);
        return tag ? tag.color : '#10b981';
    }
    
    selectFolder(folderId) {
        this.currentFolder = folderId;
        this.currentFilter = folderId ? 'folder' : 'all';
        
        // Update active state
        document.querySelectorAll('.folder-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeItem = document.querySelector(`[data-folder-id="${folderId}"]`) || 
                           document.querySelector('.folder-item:first-child');
        if (activeItem) {
            activeItem.classList.add('active');
        }
        
        this.updateBreadcrumb();
        this.renderBookmarks();
    }
    
    applyFilter(filter) {
        this.currentFilter = filter;
        this.currentFolder = null;
        
        // Update active state
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('ring-2', 'ring-blue-500');
        });
        document.querySelector(`[data-filter="${filter}"]`).classList.add('ring-2', 'ring-blue-500');
        
        // Update folder selection
        document.querySelectorAll('.folder-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector('.folder-item:first-child').classList.add('active');
        
        this.updateBreadcrumb();
        this.renderBookmarks();
    }
    
    toggleTagFilter(tagName) {
        if (this.selectedTags.includes(tagName)) {
            this.selectedTags = this.selectedTags.filter(t => t !== tagName);
        } else {
            this.selectedTags.push(tagName);
        }
        
        this.renderBookmarks();
    }
    
    handleSearch(query) {
        this.searchQuery = query;
        this.renderBookmarks();
    }
    
    handleSort(sort) {
        this.currentSort = sort;
        this.renderBookmarks();
    }
    
    setViewMode(mode) {
        this.viewMode = mode;
        
        // Update button states
        document.getElementById('gridViewBtn').classList.toggle('text-blue-600', mode === 'grid');
        document.getElementById('listViewBtn').classList.toggle('text-blue-600', mode === 'list');
        
        this.renderBookmarks();
    }
    
    updateBreadcrumb() {
        const breadcrumb = document.getElementById('breadcrumb');
        let path = ['<span class="hover:text-blue-600 cursor-pointer" onclick="bookmarkManager.selectFolder(null)">Home</span>'];
        
        if (this.currentFolder) {
            const folder = this.folders.find(f => f.id === this.currentFolder);
            if (folder) {
                path.push(`<span class="text-gray-400 mx-2">/</span>`);
                path.push(`<span class="hover:text-blue-600 cursor-pointer" onclick="bookmarkManager.selectFolder('${folder.id}')">${folder.name}</span>`);
            }
        }
        
        breadcrumb.innerHTML = path.join('');
    }
    
    toggleImportExportMenu() {
        const menu = document.getElementById('importExportMenu');
        menu.classList.toggle('hidden');
    }
    
    openImportModal() {
        document.getElementById('importModal').classList.remove('hidden');
        document.getElementById('importExportMenu').classList.add('hidden');
    }
    
    closeImportModal() {
        document.getElementById('importModal').classList.add('hidden');
        document.getElementById('importResults').classList.add('hidden');
        document.getElementById('importFile').value = '';
    }
    
    handleImportFile(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target.result;
                const format = file.name.endsWith('.csv') ? 'csv' : 'json';
                this.importData = content;
                this.importFormat = format;
            } catch (error) {
                this.showToast('Invalid file format', 'error');
            }
        };
        reader.readAsText(file);
    }
    
    async importBookmarks() {
        if (!this.importData) {
            this.showToast('Please select a file to import', 'error');
            return;
        }
        
        this.showLoading();
        
        try {
            const response = await fetch('/api/bookmarks/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: this.importData,
                    format: this.importFormat,
                    overwrite: document.getElementById('importOverwrite').checked
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                const results = result.data;
                const resultsHtml = `
                    <div class="text-sm">
                        <p class="text-green-600">✓ ${results.imported} bookmarks imported</p>
                        ${results.skipped > 0 ? `<p class="text-yellow-600">⚠ ${results.skipped} bookmarks skipped (duplicates)</p>` : ''}
                        ${results.errors.length > 0 ? `<p class="text-red-600">✗ ${results.errors.length} errors occurred</p>` : ''}
                    </div>
                `;
                
                document.getElementById('importResults').innerHTML = resultsHtml;
                document.getElementById('importResults').classList.remove('hidden');
                
                this.loadBookmarks();
                this.showToast('Import completed', 'success');
            } else {
                this.showToast(result.error || 'Import failed', 'error');
            }
        } catch (error) {
            console.error('Error importing bookmarks:', error);
            this.showToast('Network error importing bookmarks', 'error');
        } finally {
            this.hideLoading();
        }
    }
    
    async exportBookmarks(format) {
        try {
            const response = await fetch(`/api/bookmarks/export?format=${format}`);
            const blob = await response.blob();
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bookmarks.${format}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            this.showToast(`Bookmarks exported as ${format.toUpperCase()}`, 'success');
        } catch (error) {
            console.error('Error exporting bookmarks:', error);
            this.showToast('Export failed', 'error');
        }
    }
    
    async syncBookmarks() {
        this.showLoading();
        
        try {
            const response = await fetch('/api/bookmarks/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ device_id: this.deviceId })
            });
            
            const result = await response.json();
            
            if (result.success) {
                const syncData = result.data;
                if (syncData.updated > 0) {
                    this.showToast(`${syncData.updated} bookmarks synced`, 'success');
                    this.loadBookmarks();
                } else {
                    this.showToast('All bookmarks are up to date', 'info');
                }
            } else {
                this.showToast(result.error || 'Sync failed', 'error');
            }
        } catch (error) {
            console.error('Error syncing bookmarks:', error);
            this.showToast('Network error syncing bookmarks', 'error');
        } finally {
            this.hideLoading();
        }
    }
    
    startAutoSync() {
        // Auto-sync every 5 minutes
        setInterval(() => {
            this.syncBookmarks();
        }, 5 * 60 * 1000);
    }
    
    handleBookmarkReorder(evt) {
        const bookmarkId = evt.item.dataset.bookmarkId;
        const newIndex = evt.newIndex;
        const oldIndex = evt.oldIndex;
        
        if (newIndex !== oldIndex) {
            // Update sort order in backend
            this.updateBookmarkSortOrder(bookmarkId, newIndex);
        }
    }
    
    async updateBookmarkSortOrder(bookmarkId, newOrder) {
        try {
            await fetch(`/api/bookmarks/${bookmarkId}/sort`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sort_order: newOrder })
            });
        } catch (error) {
            console.error('Error updating bookmark sort order:', error);
        }
    }
    
    toggleSidebar() {
        const sidebar = document.getElementById('folderSidebar');
        sidebar.classList.toggle('hidden');
    }
    
    showLoading() {
        document.getElementById('loadingOverlay').classList.remove('hidden');
    }
    
    hideLoading() {
        document.getElementById('loadingOverlay').classList.add('hidden');
    }
    
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        
        const bgColor = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            warning: 'bg-yellow-500',
            info: 'bg-blue-500'
        }[type];
        
        toast.className = `${bgColor} text-white px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.classList.remove('translate-x-full');
        }, 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.add('translate-x-full');
            setTimeout(() => {
                container.removeChild(toast);
            }, 300);
        }, 3000);
    }
    
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`;
        
        return date.toLocaleDateString();
    }
    
    showFolderContextMenu(e, folder) {
        // Create context menu for folder operations
        const menu = document.createElement('div');
        menu.className = 'fixed bg-white rounded-lg shadow-lg py-2 z-50';
        menu.style.left = `${e.pageX}px`;
        menu.style.top = `${e.pageY}px`;
        
        menu.innerHTML = `
            <button class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onclick="bookmarkManager.editFolder('${folder.id}')">
                <i class="fas fa-edit mr-2"></i>Edit Folder
            </button>
            <button class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onclick="bookmarkManager.deleteFolder('${folder.id}')">
                <i class="fas fa-trash mr-2"></i>Delete Folder
            </button>
        `;
        
        document.body.appendChild(menu);
        
        // Remove menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', function removeMenu() {
                document.body.removeChild(menu);
                document.removeEventListener('click', removeMenu);
            });
        }, 100);
    }
    
    editFolder(folderId) {
        const folder = this.folders.find(f => f.id === folderId);
        if (folder) {
            this.openFolderModal(folder);
        }
    }
    
    async deleteFolder(folderId) {
        const folder = this.folders.find(f => f.id === folderId);
        if (!folder) return;
        
        if (!confirm(`Are you sure you want to delete the folder "${folder.name}"? Bookmarks will be moved to the root level.`)) {
            return;
        }
        
        try {
            const response = await fetch(`/api/bookmarks/folders/${folderId}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast('Folder deleted', 'success');
                this.loadBookmarks();
            } else {
                this.showToast(result.error || 'Failed to delete folder', 'error');
            }
        } catch (error) {
            console.error('Error deleting folder:', error);
            this.showToast('Network error deleting folder', 'error');
        }
    }
}

// Initialize the bookmark manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.bookmarkManager = new BookmarkManager();
});
