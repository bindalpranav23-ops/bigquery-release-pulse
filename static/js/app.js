// --- STATE MANAGEMENT ---
let allReleaseNotes = [];
let filteredNotes = [];
let activeCategory = 'all';
let searchQuery = '';
let selectedNote = null;
let isFetching = false;

// --- DOM ELEMENTS ---
const refreshBtn = document.getElementById('refresh-btn');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');
const filterPillsContainer = document.getElementById('filter-pills-container');
const notesContainer = document.getElementById('notes-container');
const emptyState = document.getElementById('empty-state');
const errorState = document.getElementById('error-state');
const errorMessage = document.getElementById('error-message');
const retryBtn = document.getElementById('retry-btn');
const resetFiltersBtn = document.getElementById('reset-filters-btn');

// Stats Elements
const statTotal = document.getElementById('stat-total');
const statFeatures = document.getElementById('stat-features');
const statIssues = document.getElementById('stat-issues');
const statDeprecations = document.getElementById('stat-deprecations');
const statCards = document.querySelectorAll('.stat-card');

// Modal Elements
const tweetModal = document.getElementById('tweet-modal');
const modalCloseBtn = document.getElementById('close-modal-btn');
const modalCategoryBadge = document.getElementById('modal-category-badge');
const modalDate = document.getElementById('modal-date');
const modalHtmlContent = document.getElementById('modal-html-content');
const modalSourceLink = document.getElementById('modal-source-link');
const tweetTextarea = document.getElementById('tweet-textarea');
const charCount = document.getElementById('char-count');
const xPreviewText = document.getElementById('x-preview-text');
const sendTweetBtn = document.getElementById('send-tweet-btn');

// --- API CALLS ---
async function fetchNotes() {
    if (isFetching) return;
    
    setLoadingState(true);
    showErrorState(false);
    
    try {
        const response = await fetch('/api/release-notes');
        const result = await response.json();
        
        if (result.success) {
            allReleaseNotes = result.data;
            updateDashboardStats();
            applyFiltersAndSearch();
            updateLastUpdatedTime();
        } else {
            throw new Error(result.error || "Failed to load release notes");
        }
    } catch (err) {
        console.error("Fetch Error:", err);
        showErrorState(true, err.message);
    } finally {
        setLoadingState(false);
    }
}

// --- STATE UI SETTERS ---
function setLoadingState(loading) {
    isFetching = loading;
    if (loading) {
        refreshBtn.classList.add('loading');
        refreshBtn.disabled = true;
        
        // Show skeleton loaders
        notesContainer.innerHTML = Array(6).fill('<div class="skeleton-card"></div>').join('');
        emptyState.style.display = 'none';
        errorState.style.display = 'none';
    } else {
        refreshBtn.classList.remove('loading');
        refreshBtn.disabled = false;
    }
}

function showErrorState(show, message = '') {
    if (show) {
        notesContainer.innerHTML = '';
        errorState.style.display = 'block';
        errorMessage.textContent = message;
        emptyState.style.display = 'none';
    } else {
        errorState.style.display = 'none';
    }
}

function updateLastUpdatedTime() {
    const lastUpdatedText = document.getElementById('last-updated-text');
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    lastUpdatedText.textContent = `Last updated: ${timeStr} (Live)`;
}

// --- STATS & COUNTS ---
function updateDashboardStats() {
    const total = allReleaseNotes.length;
    
    const features = allReleaseNotes.filter(n => n.type.toLowerCase().includes('feature')).length;
    const issues = allReleaseNotes.filter(n => n.type.toLowerCase().includes('issue')).length;
    const deprecations = allReleaseNotes.filter(n => n.type.toLowerCase().includes('deprecation')).length;
    
    // Animate numbers
    animateNumber(statTotal, total);
    animateNumber(statFeatures, features);
    animateNumber(statIssues, issues);
    animateNumber(statDeprecations, deprecations);
}

function animateNumber(element, target) {
    let current = parseInt(element.textContent) || 0;
    if (current === target) return;
    
    const duration = 800; // ms
    const stepTime = Math.abs(Math.floor(duration / (target - current + 1)));
    const increment = target > current ? 1 : -1;
    
    const timer = setInterval(() => {
        current += increment;
        element.textContent = current;
        if (current === target) {
            clearInterval(timer);
        }
    }, Math.max(stepTime, 15));
}

// --- SEARCH & FILTER LOGIC ---
function applyFiltersAndSearch() {
    filteredNotes = allReleaseNotes.filter(note => {
        // 1. Category Filter
        const typeLower = note.type.toLowerCase();
        let matchesCategory = true;
        
        if (activeCategory === 'feature') {
            matchesCategory = typeLower.includes('feature');
        } else if (activeCategory === 'issue') {
            matchesCategory = typeLower.includes('issue');
        } else if (activeCategory === 'deprecation') {
            matchesCategory = typeLower.includes('deprecation');
        } else if (activeCategory === 'other') {
            matchesCategory = !typeLower.includes('feature') && 
                              !typeLower.includes('issue') && 
                              !typeLower.includes('deprecation');
        }
        
        // 2. Search Query Filter
        let matchesSearch = true;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            matchesSearch = note.date.toLowerCase().includes(query) ||
                            note.type.toLowerCase().includes(query) ||
                            note.text.toLowerCase().includes(query);
        }
        
        return matchesCategory && matchesSearch;
    });
    
    renderCards();
}

// --- RENDERING ---
function getCategoryCSSColor(type) {
    const typeLower = type.toLowerCase();
    if (typeLower.includes('feature')) return 'var(--cat-feature)';
    if (typeLower.includes('issue')) return 'var(--cat-issue)';
    if (typeLower.includes('deprecation')) return 'var(--cat-deprecation)';
    return 'var(--cat-other)';
}

function getBadgeHTML(type) {
    const typeLower = type.toLowerCase();
    let badgeClass = 'badge-other';
    
    if (typeLower.includes('feature')) badgeClass = 'badge-feature';
    else if (typeLower.includes('issue')) badgeClass = 'badge-issue';
    else if (typeLower.includes('deprecation')) badgeClass = 'badge-deprecation';
    
    return `<span class="badge ${badgeClass}">${type}</span>`;
}

function renderCards() {
    notesContainer.innerHTML = '';
    
    if (filteredNotes.length === 0) {
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    
    filteredNotes.forEach((note, index) => {
        const card = document.createElement('div');
        card.className = 'note-card';
        
        // Set category color variable
        card.style.setProperty('--tag-color', getCategoryCSSColor(note.type));
        
        card.innerHTML = `
            <div class="card-top">
                <div class="card-meta">
                    ${getBadgeHTML(note.type)}
                    <span class="card-date">${note.date}</span>
                </div>
                <div class="card-content">
                    ${note.html}
                </div>
            </div>
            <div class="card-footer">
                <button class="card-action-btn craft-btn" data-index="${index}">
                    <i class="fa-brands fa-x-twitter"></i>
                    <span>Draft Tweet</span>
                </button>
            </div>
        `;
        
        // Clicking anywhere on the card opens modal
        card.addEventListener('click', (e) => {
            // If user clicked the button itself, let the button listener handle it
            if (e.target.closest('.craft-btn')) return;
            openModal(note);
        });
        
        // Craft button listener
        const craftBtn = card.querySelector('.craft-btn');
        craftBtn.addEventListener('click', () => {
            openModal(note);
        });
        
        notesContainer.appendChild(card);
    });
}

// --- MODAL & TWEET COMPOSER ---
function openModal(note) {
    selectedNote = note;
    
    // Set Badge & Colors
    modalCategoryBadge.className = `badge ${getBadgeClass(note.type)}`;
    modalCategoryBadge.textContent = note.type;
    modalDate.textContent = note.date;
    
    // Fill original html content
    modalHtmlContent.innerHTML = note.html;
    
    // Set link
    modalSourceLink.href = note.link;
    
    // Construct default Tweet
    const defaultTweet = constructDefaultTweet(note);
    tweetTextarea.value = defaultTweet;
    
    // Update live preview & character counter
    updateTweetStats();
    
    // Show Modal
    tweetModal.style.display = 'flex';
    // Delay adding active class for CSS transition to trigger
    setTimeout(() => {
        tweetModal.classList.add('active');
    }, 10);
}

function getBadgeClass(type) {
    const typeLower = type.toLowerCase();
    if (typeLower.includes('feature')) return 'badge-feature';
    if (typeLower.includes('issue')) return 'badge-issue';
    if (typeLower.includes('deprecation')) return 'badge-deprecation';
    return 'badge-other';
}

function constructDefaultTweet(note) {
    const header = `📢 BigQuery ${note.type} (${note.date}):\n`;
    
    // We want the total to be <= 280. 
    // Format: "[Header][truncated_desc]...\n\nRead more: [Link]\n#BigQuery #GoogleCloud"
    const hashTags = "\n#BigQuery #GoogleCloud";
    const linkStr = `\n\nRead details: ${note.link}`;
    
    const fixedLength = header.length + linkStr.length + hashTags.length + 5; // 5 char buffer for ellipses
    const maxDescLength = 280 - fixedLength;
    
    let desc = note.text;
    if (desc.length > maxDescLength) {
        desc = desc.substring(0, maxDescLength - 3) + "...";
    }
    
    return `${header}${desc}${linkStr}${hashTags}`;
}

function updateTweetStats() {
    const text = tweetTextarea.value;
    const count = text.length;
    
    charCount.textContent = count;
    
    // Counter Warning and Danger Styles
    charCount.className = 'character-counter';
    if (count > 280) {
        charCount.classList.add('danger');
        sendTweetBtn.disabled = true;
    } else if (count > 260) {
        charCount.classList.add('warning');
        sendTweetBtn.disabled = false;
    } else {
        sendTweetBtn.disabled = false;
    }
    
    // Render Live Preview
    // Convert links inside text to clickable elements (purely cosmetic for preview)
    let previewHtml = escapeHTML(text);
    // Basic URL regex to highlight links in preview
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    previewHtml = previewHtml.replace(urlRegex, (url) => {
        return `<span style="color: #1d9bf0;">${url}</span>`;
    });
    // Basic hashtag regex
    const hashRegex = /(#[a-zA-Z0-9_]+)/g;
    previewHtml = previewHtml.replace(hashRegex, (hashtag) => {
        return `<span style="color: #1d9bf0;">${hashtag}</span>`;
    });
    
    xPreviewText.innerHTML = previewHtml;
}

function escapeHTML(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function closeModal() {
    tweetModal.classList.remove('active');
    setTimeout(() => {
        tweetModal.style.display = 'none';
        selectedNote = null;
    }, 300);
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    // Refresh Button
    refreshBtn.addEventListener('click', fetchNotes);
    retryBtn.addEventListener('click', fetchNotes);
    
    // Search Input
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        if (searchQuery.trim().length > 0) {
            clearSearchBtn.style.display = 'block';
        } else {
            clearSearchBtn.style.display = 'none';
        }
        applyFiltersAndSearch();
    });
    
    // Clear Search
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        applyFiltersAndSearch();
        searchInput.focus();
    });
    
    // Reset Filters button in Empty state
    resetFiltersBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        activeCategory = 'all';
        
        // Reset pills UI
        document.querySelectorAll('.filter-pill').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === 'all');
        });
        
        applyFiltersAndSearch();
    });
    
    // Filter Pills
    filterPillsContainer.addEventListener('click', (e) => {
        const pill = e.target.closest('.filter-pill');
        if (!pill) return;
        
        // Remove active class from other pills
        document.querySelectorAll('.filter-pill').forEach(btn => btn.classList.remove('active'));
        
        // Set active pill
        pill.classList.add('active');
        activeCategory = pill.dataset.category;
        
        applyFiltersAndSearch();
    });
    
    // Dashboard Stat Cards click -> filter by category!
    statCards.forEach(card => {
        card.addEventListener('click', () => {
            const filterCat = card.dataset.filter;
            activeCategory = filterCat;
            
            // Sync filter pills UI
            document.querySelectorAll('.filter-pill').forEach(pill => {
                pill.classList.toggle('active', pill.dataset.category === filterCat);
            });
            
            applyFiltersAndSearch();
        });
    });
    
    // Modal Close
    modalCloseBtn.addEventListener('click', closeModal);
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) closeModal();
    });
    
    // Esc key close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && tweetModal.classList.contains('active')) {
            closeModal();
        }
    });
    
    // Textarea editing
    tweetTextarea.addEventListener('input', updateTweetStats);
    
    // Tweet Share Button click
    sendTweetBtn.addEventListener('click', () => {
        if (!selectedNote) return;
        const text = tweetTextarea.value;
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank', 'width=600,height=400,resizable=yes');
    });
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    fetchNotes();
});
