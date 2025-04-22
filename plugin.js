/**
 * Jellyfin-Jellyseerr Integration Plugin
 * 
 * This plugin integrates Jellyseerr functionality into Jellyfin, allowing users to:
 * - Browse content by network/studio
 * - See what content is available or not in their library
 * - Request missing content directly from the Jellyfin interface
 */

// Plugin configuration
const pluginConfig = {
    // Plugin metadata
    id: "JellyfinJellyseerrIntegration",
    name: "Jellyseerr Integration",
    version: "1.0.0",
    description: "Integrates Jellyseerr functionality into Jellyfin",
    
    // Default settings (will be configurable in Jellyfin dashboard)
    defaultSettings: {
        jellyseerrUrl: "http://localhost:5055",
        jellyseerrApiKey: "",
        refreshInterval: 12, // hours
        displayNetworks: ["HBO", "Netflix", "Disney", "Amazon", "Apple TV+", "Hulu", "Paramount+"], // Default networks to display
        displayStudios: ["Warner Bros.", "Universal Pictures", "Sony Pictures", "Paramount Pictures"] // Default studios to display
    }
};

// Main plugin class
class JellyseerrIntegrationPlugin {
    constructor(options) {
        this.options = Object.assign({}, pluginConfig.defaultSettings, options);
        this.serverConnector = new JellyseerrServerConnector(this.options);
        this.networkCache = {};
        this.studioCache = {};
        this.lastRefresh = null;
    }

    // Initialize the plugin
    async init() {
        console.log("Initializing Jellyseerr Integration Plugin");
        
        // Register UI components
        this.registerComponents();
        
        // Initial data refresh
        await this.refreshData();
        
        // Set up refresh interval
        setInterval(() => this.refreshData(), this.options.refreshInterval * 60 * 60 * 1000);
        
        // Add event listeners
        document.addEventListener("jellyfin-view-change", this.handleViewChange.bind(this));
    }
    
    // Register UI components with Jellyfin
    registerComponents() {
        // Add "Networks & Studios" section to home screen
        Jellyfin.Components.registerHomeSection({
            name: "jellyseerr-networks",
            type: "networks",
            title: "Networks & Studios",
            order: 4,
            render: this.renderNetworksAndStudios.bind(this)
        });
        
        // Add to library browse menu
        Jellyfin.Navigation.registerMenuItem({
            name: "jellyseerr-networks-browse",
            title: "Networks & Studios",
            path: "/jellyseerr/browse",
            icon: "tv",
            handler: this.openNetworkBrowser.bind(this)
        });
    }
    
    // Refresh data from Jellyseerr
    async refreshData() {
        console.log("Refreshing data from Jellyseerr");
        this.lastRefresh = new Date();
        
        try {
            // Get networks data
            const networksData = await this.serverConnector.getNetworks();
            this.networkCache = networksData.reduce((acc, network) => {
                acc[network.id] = network;
                return acc;
            }, {});
            
            // Get studios data
            const studiosData = await this.serverConnector.getStudios();
            this.studioCache = studiosData.reduce((acc, studio) => {
                acc[studio.id] = studio;
                return acc;
            }, {});
            
            console.log(`Refreshed data: ${Object.keys(this.networkCache).length} networks, ${Object.keys(this.studioCache).length} studios`);
            
            // Trigger UI update if needed
            this.updateUI();
        } catch (error) {
            console.error("Error refreshing data from Jellyseerr:", error);
        }
    }
    
    // Handle view change events
    handleViewChange(event) {
        const view = event.detail.view;
        
        // If navigating to our custom views, render them
        if (view.startsWith('/jellyseerr/')) {
            this.renderCustomView(view);
        }
    }
    
    // Render networks and studios on the home page
    renderNetworksAndStudios(container) {
        // Clear container
        container.innerHTML = '';
        
        // Create networks section
        const networksSection = document.createElement('div');
        networksSection.className = 'section networks-section';
        
        // Create section header
        const header = document.createElement('h2');
        header.textContent = 'Popular Networks & Studios';
        networksSection.appendChild(header);
        
        // Create horizontal scroll container for networks
        const networksList = document.createElement('div');
        networksList.className = 'horizontal-scroll';
        
        // Add networks
        this.options.displayNetworks.forEach(networkName => {
            const network = Object.values(this.networkCache).find(n => n.name === networkName);
            if (network) {
                const networkCard = this.createNetworkCard(network);
                networksList.appendChild(networkCard);
            }
        });
        
        networksSection.appendChild(networksList);
        container.appendChild(networksSection);
        
        // Create studios section
        const studiosSection = document.createElement('div');
        studiosSection.className = 'section studios-section';
        
        // Create section header
        const studiosHeader = document.createElement('h2');
        studiosHeader.textContent = 'Popular Studios';
        studiosSection.appendChild(studiosHeader);
        
        // Create horizontal scroll container for studios
        const studiosList = document.createElement('div');
        studiosList.className = 'horizontal-scroll';
        
        // Add studios
        this.options.displayStudios.forEach(studioName => {
            const studio = Object.values(this.studioCache).find(s => s.name === studioName);
            if (studio) {
                const studioCard = this.createStudioCard(studio);
                studiosList.appendChild(studioCard);
            }
        });
        
        studiosSection.appendChild(studiosList);
        container.appendChild(studiosSection);
    }
    
    // Create a network card
    createNetworkCard(network) {
        const card = document.createElement('div');
        card.className = 'card network-card';
        card.dataset.id = network.id;
        
        // Card image
        const imgContainer = document.createElement('div');
        imgContainer.className = 'card-img';
        
        const img = document.createElement('img');
        img.src = network.logoPath ? 
            `https://image.tmdb.org/t/p/w300${network.logoPath}` : 
            'plugins/JellyfinJellyseerrIntegration/images/default-network.png';
        img.alt = network.name;
        
        imgContainer.appendChild(img);
        card.appendChild(imgContainer);
        
        // Card title
        const title = document.createElement('div');
        title.className = 'card-title';
        title.textContent = network.name;
        card.appendChild(title);
        
        // Add click handler
        card.addEventListener('click', () => {
            this.openNetworkContent(network);
        });
        
        return card;
    }
    
    // Create a studio card
    createStudioCard(studio) {
        const card = document.createElement('div');
        card.className = 'card studio-card';
        card.dataset.id = studio.id;
        
        // Card image
        const imgContainer = document.createElement('div');
        imgContainer.className = 'card-img';
        
        const img = document.createElement('img');
        img.src = studio.logoPath ? 
            `https://image.tmdb.org/t/p/w300${studio.logoPath}` : 
            'plugins/JellyfinJellyseerrIntegration/images/default-studio.png';
        img.alt = studio.name;
        
        imgContainer.appendChild(img);
        card.appendChild(imgContainer);
        
        // Card title
        const title = document.createElement('div');
        title.className = 'card-title';
        title.textContent = studio.name;
        card.appendChild(title);
        
        // Add click handler
        card.addEventListener('click', () => {
            this.openStudioContent(studio);
        });
        
        return card;
    }
    
    // Open network browser page
    openNetworkBrowser() {
        Jellyfin.Navigation.navigate('/jellyseerr/browse');
    }
    
    // Open network content page
    openNetworkContent(network) {
        Jellyfin.Navigation.navigate(`/jellyseerr/network/${network.id}`);
    }
    
    // Open studio content page
    openStudioContent(studio) {
        Jellyfin.Navigation.navigate(`/jellyseerr/studio/${studio.id}`);
    }
    
    // Render custom view based on path
    async renderCustomView(path) {
        const container = document.querySelector('#content-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (path === '/jellyseerr/browse') {
            this.renderBrowsePage(container);
        } else if (path.startsWith('/jellyseerr/network/')) {
            const networkId = path.split('/').pop();
            await this.renderNetworkContentPage(container, networkId);
        } else if (path.startsWith('/jellyseerr/studio/')) {
            const studioId = path.split('/').pop();
            await this.renderStudioContentPage(container, studioId);
        }
    }
    
    // Render browse page with all networks and studios
    renderBrowsePage(container) {
        const pageContainer = document.createElement('div');
        pageContainer.className = 'browse-page';
        
        // Page title
        const title = document.createElement('h1');
        title.textContent = 'Browse Networks & Studios';
        pageContainer.appendChild(title);
        
        // Networks section
        const networksSection = document.createElement('div');
        networksSection.className = 'browse-section';
        
        const networksTitle = document.createElement('h2');
        networksTitle.textContent = 'Networks';
        networksSection.appendChild(networksTitle);
        
        const networksGrid = document.createElement('div');
        networksGrid.className = 'grid-container';
        
        // Add all networks
        Object.values(this.networkCache)
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(network => {
                const card = this.createNetworkCard(network);
                networksGrid.appendChild(card);
            });
        
        networksSection.appendChild(networksGrid);
        pageContainer.appendChild(networksSection);
        
        // Studios section
        const studiosSection = document.createElement('div');
        studiosSection.className = 'browse-section';
        
        const studiosTitle = document.createElement('h2');
        studiosTitle.textContent = 'Studios';
        studiosSection.appendChild(studiosTitle);
        
        const studiosGrid = document.createElement('div');
        studiosGrid.className = 'grid-container';
        
        // Add all studios
        Object.values(this.studioCache)
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(studio => {
                const card = this.createStudioCard(studio);
                studiosGrid.appendChild(card);
            });
        
        studiosSection.appendChild(studiosGrid);
        pageContainer.appendChild(studiosSection);
        
        container.appendChild(pageContainer);
    }
    
    // Render network content page
    async renderNetworkContentPage(container, networkId) {
        const network = this.networkCache[networkId];
        if (!network) {
            container.innerHTML = '<h1>Network not found</h1>';
            return;
        }
        
        const pageContainer = document.createElement('div');
        pageContainer.className = 'content-page network-content-page';
        
        // Page header with network info
        const header = document.createElement('div');
        header.className = 'content-header';
        
        const logo = document.createElement('img');
        logo.src = network.logoPath ? 
            `https://image.tmdb.org/t/p/w500${network.logoPath}` : 
            'plugins/JellyfinJellyseerrIntegration/images/default-network.png';
        logo.alt = network.name;
        
        const title = document.createElement('h1');
        title.textContent = network.name;
        
        header.appendChild(logo);
        header.appendChild(title);
        pageContainer.appendChild(header);
        
        // Get content for this network
        try {
            const content = await this.serverConnector.getNetworkContent(networkId);
            
            // Movies section
            if (content.movies && content.movies.length > 0) {
                const moviesSection = this.createContentSection('Movies', content.movies);
                pageContainer.appendChild(moviesSection);
            }
            
            // TV Shows section
            if (content.tvShows && content.tvShows.length > 0) {
                const tvShowsSection = this.createContentSection('TV Shows', content.tvShows);
                pageContainer.appendChild(tvShowsSection);
            }
            
        } catch (error) {
            console.error(`Error fetching content for network ${networkId}:`, error);
            const errorMsg = document.createElement('div');
            errorMsg.className = 'error-message';
            errorMsg.textContent = 'Failed to load content for this network.';
            pageContainer.appendChild(errorMsg);
        }
        
        container.appendChild(pageContainer);
    }
    
    // Render studio content page
    async renderStudioContentPage(container, studioId) {
        const studio = this.studioCache[studioId];
        if (!studio) {
            container.innerHTML = '<h1>Studio not found</h1>';
            return;
        }
        
        const pageContainer = document.createElement('div');
        pageContainer.className = 'content-page studio-content-page';
        
        // Page header with studio info
        const header = document.createElement('div');
        header.className = 'content-header';
        
        const logo = document.createElement('img');
        logo.src = studio.logoPath ? 
            `https://image.tmdb.org/t/p/w500${studio.logoPath}` : 
            'plugins/JellyfinJellyseerrIntegration/images/default-studio.png';
        logo.alt = studio.name;
        
        const title = document.createElement('h1');
        title.textContent = studio.name;
        
        header.appendChild(logo);
        header.appendChild(title);
        pageContainer.appendChild(header);
        
        // Get content for this studio
        try {
            const content = await this.serverConnector.getStudioContent(studioId);
            
            // Movies section
            if (content.movies && content.movies.length > 0) {
                const moviesSection = this.createContentSection('Movies', content.movies);
                pageContainer.appendChild(moviesSection);
            }
            
            // TV Shows section
            if (content.tvShows && content.tvShows.length > 0) {
                const tvShowsSection = this.createContentSection('TV Shows', content.tvShows);
                pageContainer.appendChild(tvShowsSection);
            }
            
        } catch (error) {
            console.error(`Error fetching content for studio ${studioId}:`, error);
            const errorMsg = document.createElement('div');
            errorMsg.className = 'error-message';
            errorMsg.textContent = 'Failed to load content for this studio.';
            pageContainer.appendChild(errorMsg);
        }
        
        container.appendChild(pageContainer);
    }
    
    // Create a content section (movies or TV shows)
    createContentSection(title, items) {
        const section = document.createElement('div');
        section.className = 'content-section';
        
        const sectionTitle = document.createElement('h2');
        sectionTitle.textContent = title;
        section.appendChild(sectionTitle);
        
        const contentGrid = document.createElement('div');
        contentGrid.className = 'content-grid';
        
        // Add content items
        items.forEach(item => {
            const contentCard = this.createContentCard(item);
            contentGrid.appendChild(contentCard);
        });
        
        section.appendChild(contentGrid);
        return section;
    }
    
    // Create a content card (movie or TV show)
    createContentCard(item) {
        const card = document.createElement('div');
        card.className = 'content-card';
        card.dataset.id = item.id;
        card.dataset.mediaType = item.mediaType;
        
        // Card image
        const imgContainer = document.createElement('div');
        imgContainer.className = 'card-img';
        
        const img = document.createElement('img');
        img.src = item.posterPath ? 
            `https://image.tmdb.org/t/p/w342${item.posterPath}` : 
            `plugins/JellyfinJellyseerrIntegration/images/default-${item.mediaType}.png`;
        img.alt = item.title || item.name;
        
        imgContainer.appendChild(img);
        
        // Add availability badge
        const badge = document.createElement('div');
        badge.className = `availability-badge ${item.available ? 'available' : 'not-available'}`;
        badge.textContent = item.available ? 'Available' : 'Not Available';
        imgContainer.appendChild(badge);
        
        card.appendChild(imgContainer);
        
        // Card title
        const title = document.createElement('div');
        title.className = 'card-title';
        title.textContent = item.title || item.name;
        card.appendChild(title);
        
        // Card info
        const info = document.createElement('div');
        info.className = 'card-info';
        
        if (item.releaseDate || item.firstAirDate) {
            const date = new Date(item.releaseDate || item.firstAirDate);
            const year = date.getFullYear();
            info.textContent = year;
        }
        
        card.appendChild(info);
        
        // Request button (if not available)
        if (!item.available) {
            const requestBtn = document.createElement('button');
            requestBtn.className = 'request-button';
            requestBtn.textContent = 'Request';
            requestBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.requestContent(item);
            });
            card.appendChild(requestBtn);
        }
        
        // Add click handler to open item details
        card.addEventListener('click', () => {
            if (item.available) {
                // If available, navigate to Jellyfin item
                if (item.jellyfinId) {
                    Jellyfin.Navigation.navigate(`/details?id=${item.jellyfinId}`);
                }
            } else {
                // If not available, open details modal
                this.openDetailsModal(item);
            }
        });
        
        return card;
    }
    
    // Open details modal for content that's not in the library
    openDetailsModal(item) {
        // Check if modal container exists, create if not
        let modalContainer = document.querySelector('#jellyseerr-modal-container');
        if (!modalContainer) {
            modalContainer = document.createElement('div');
            modalContainer.id = 'jellyseerr-modal-container';
            document.body.appendChild(modalContainer);
        }
        
        // Clear existing modal
        modalContainer.innerHTML = '';
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'jellyseerr-modal';
        
        // Modal header with close button
        const header = document.createElement('div');
        header.className = 'modal-header';
        
        const title = document.createElement('h2');
        title.textContent = item.title || item.name;
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-button';
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', () => {
            modalContainer.innerHTML = '';
            modalContainer.style.display = 'none';
        });
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        modal.appendChild(header);
        
        // Modal content
        const content = document.createElement('div');
        content.className = 'modal-content';
        
        // Poster image
        const poster = document.createElement('img');
        poster.className = 'modal-poster';
        poster.src = item.posterPath ? 
            `https://image.tmdb.org/t/p/w500${item.posterPath}` : 
            `plugins/JellyfinJellyseerrIntegration/images/default-${item.mediaType}.png`;
        poster.alt = item.title || item.name;
        content.appendChild(poster);
        
        // Details container
        const details = document.createElement('div');
        details.className = 'modal-details';
        
        // Release year
        if (item.releaseDate || item.firstAirDate) {
            const date = new Date(item.releaseDate || item.firstAirDate);
            const year = document.createElement('div');
            year.className = 'detail-item';
            year.innerHTML = `<span class="detail-label">Year:</span> ${date.getFullYear()}`;
            details.appendChild(year);
        }
        
        // Overview
        if (item.overview) {
            const overview = document.createElement('div');
            overview.className = 'detail-item overview';
            overview.innerHTML = `<span class="detail-label">Overview:</span> ${item.overview}`;
            details.appendChild(overview);
        }
        
        // Request button
        const requestBtn = document.createElement('button');
        requestBtn.className = 'request-button modal-request-button';
        requestBtn.textContent = 'Request';
        requestBtn.addEventListener('click', () => {
            this.requestContent(item);
            modalContainer.innerHTML = '';
            modalContainer.style.display = 'none';
        });
        details.appendChild(requestBtn);
        
        content.appendChild(details);
        modal.appendChild(content);
        
        // Add modal to container and show
        modalContainer.appendChild(modal);
        modalContainer.style.display = 'flex';
    }
    
    // Request content from Jellyseerr
    async requestContent(item) {
        try {
            const result = await this.serverConnector.requestContent(item.id, item.mediaType);
            
            // Show success notification
            this.showNotification('Success', `${item.title || item.name} has been requested.`, 'success');
            
            // Update UI
            const cards = document.querySelectorAll(`.content-card[data-id="${item.id}"][data-media-type="${item.mediaType}"]`);
            cards.forEach(card => {
                const badge = card.querySelector('.availability-badge');
                if (badge) {
                    badge.className = 'availability-badge requested';
                    badge.textContent = 'Requested';
                }
                
                const requestBtn = card.querySelector('.request-button');
                if (requestBtn) {
                    requestBtn.remove();
                }
            });
            
        } catch (error) {
            console.error(`Error requesting content ${item.id}:`, error);
            this.showNotification('Error', `Failed to request ${item.title || item.name}.`, 'error');
        }
    }
    
    // Show notification
    showNotification(title, message, type = 'info') {
        // Check if notification container exists, create if not
        let notifContainer = document.querySelector('#jellyseerr-notification-container');
        if (!notifContainer) {
            notifContainer = document.createElement('div');
            notifContainer.id = 'jellyseerr-notification-container';
            document.body.appendChild(notifContainer);
        }
        
        // Create notification
        const notification = document.createElement('div');
        notification.className = `jellyseerr-notification ${type}`;
        
        // Notification content
        const notifTitle = document.createElement('div');
        notifTitle.className = 'notification-title';
        notifTitle.textContent = title;
        
        const notifMessage = document.createElement('div');
        notifMessage.className = 'notification-message';
        notifMessage.textContent = message;
        
        notification.appendChild(notifTitle);
        notification.appendChild(notifMessage);
        
        // Add to container
        notifContainer.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                notification.remove();
            }, 500);
        }, 5000);
    }
    
    // Update UI elements after data refresh
    updateUI() {
        // Find any displayed network/studio sections and update them
        const homeSections = document.querySelectorAll('.networks-section, .studios-section');
        if (homeSections.length > 0) {
            const container = homeSections[0].parentElement;
            this.renderNetworksAndStudios(container);
        }
        
        // Check if we're on a custom page and refresh if needed
        const path = window.location.hash.substring(1);
        if (path.startsWith('/jellyseerr/')) {
            this.renderCustomView(path);
        }
    }
}

// Server connector class for communicating with Jellyseerr
class JellyseerrServerConnector {
    constructor(options) {
        this.baseUrl = options.jellyseerrUrl;
        this.apiKey = options.jellyseerrApiKey;
    }
    
    // Make API request to Jellyseerr
    async makeRequest(endpoint, method = 'GET', data = null) {
        const url = `${this.baseUrl}/api/v1${endpoint}`;
        
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': this.apiKey
            }
        };
        
        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(url, options);
        
        if (!response.ok) {
            throw new Error(`Jellyseerr API error: ${response.status} ${response.statusText}`);
        }
        
        return await response.json();
    }
    
    // Get all networks
    async getNetworks() {
        return await this.makeRequest('/networks');
    }
    
    // Get all studios
    async getStudios() {
        return await this.makeRequest('/studios');
    }
    
    // Get content for a specific network
    async getNetworkContent(networkId) {
        return await this.makeRequest(`/network/${networkId}/content`);
    }
    
    // Get content for a specific studio
    async getStudioContent(studioId) {
        return await this.makeRequest(`/studio/${studioId}/content`);
    }
    
    // Request content (movie or TV show)
    async requestContent(id, mediaType) {
        return await this.makeRequest(`/request`, 'POST', {
            mediaId: id,
            mediaType: mediaType
        });
    }
    
    // Check if an item exists in the Jellyfin library
    async checkLibraryStatus(tmdbId, mediaType) {
        return await this.makeRequest(`/search/status?tmdbId=${tmdbId}&mediaType=${mediaType}`);
    }
}

// CSS Styles for the plugin
const pluginStyles = `
/* Network & Studio Cards */
.network-card, .studio-card {
    width: 180px;
    height: 100px;
    margin: 10px;
    background-color: #1f1f1f;
    border-radius: 5px;
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
}

.network-card:hover, .studio-card:hover {
    transform: scale(1.05);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
}

.card-img {
    width: 100%;
    height: 70px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #2a2a2a;
    position: relative;
}

.card-img img {
    max-width: 90%;
    max-height: 90%;
    object-fit: contain;
}

.card-title {
    padding: 5px;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Content Cards */
.content-card {
    width: 160px;
    margin: 10px;
    background-color: #1f1f1f;
    border-radius: 5px;
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
    position: relative;
}

.content-card:hover {
    transform: scale(1.05);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
}

.content-card .card-img {
    width: 100%;
    height: 225px;
}

.content-card .card-img img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.availability-badge {
    position: absolute;
    top: 5px;
    right: 5px;
    padding: 3px 8px;
    border-radius: 3px;
    font-size: 12px;
    font-weight: bold;
}

.availability-badge.available {
    background-color: #4CAF50;
    color: white;
}

.availability-badge.not-available {
    background-color: #F44336;
    color: white;
}

.availability-badge.requested {
    background-color: #FF9800;
    color: white;
}

.request-button {
    background-color: #03A9F4;
    color: white;
    border: none;
    padding: 5px 10px;
    margin-top: 5px;
    border-radius: 3px;
    cursor: pointer;
    width: 100%;
    transition: background-color 0.2s;
}

.request-button:hover {
    background-color: #0288D1;
}

/* Layout */
.horizontal-scroll {
    display: flex;
    overflow-x: auto;
    padding: 10px 0;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
}

.grid-container {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
}

.content-grid {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
}

#jellyseerr-modal-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.7);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 9999;
}

.jellyseerr-modal {
    background-color: #2a2a2a;
    border-radius: 8px;
    width: 80%;
    max-width: 800px;
    max-height: 90%;
    overflow-y: auto;
    box-shadow: 0 5px 20px rgba(0, 0, 0, 0.5);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px;
    border-bottom: 1px solid #444;
}

.modal-header h2 {
    margin: 0;
    padding: 0;
    font-size: 1.4em;
}

.close-button {
    background: none;
    border: none;
    font-size: 24px;
    color: #ccc;
    cursor: pointer;
}

.close-button:hover {
    color: white;
}

.modal-content {
    padding: 15px;
    display: flex;
    flex-direction: row;
    gap: 20px;
}

@media (max-width: 768px) {
    .modal-content {
        flex-direction: column;
    }
}

.modal-poster {
    width: 200px;
    height: auto;
    border-radius: 5px;
}

.modal-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.detail-item {
    margin-bottom: 10px;
}

.detail-label {
    font-weight: bold;
    color: #aaa;
}

.overview {
    max-height: 200px;
    overflow-y: auto;
}

.modal-request-button {
    margin-top: auto;
    padding: 10px;
    font-size: 16px;
}

/* Notification */
#jellyseerr-notification-container {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.jellyseerr-notification {
    background-color: #333;
    color: white;
    padding: 15px;
    border-radius: 5px;
    width: 300px;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3);
    animation: slidein 0.5s;
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.jellyseerr-notification.success {
    border-left: 4px solid #4CAF50;
}

.jellyseerr-notification.error {
    border-left: 4px solid #F44336;
}

.jellyseerr-notification.info {
    border-left: 4px solid #2196F3;
}

.notification-title {
    font-weight: bold;
    font-size: 16px;
}

.notification-message {
    font-size: 14px;
}

.fade-out {
    animation: fadeout 0.5s;
    opacity: 0;
}

@keyframes slidein {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

@keyframes fadeout {
    from { opacity: 1; }
    to { opacity: 0; }
}

/* Content Pages */
.content-page {
    padding: 20px;
}

.content-header {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 30px;
}

.content-header img {
    max-width: 200px;
    max-height: 100px;
    object-fit: contain;
}

.content-section {
    margin-bottom: 30px;
}

.content-section h2 {
    margin-bottom: 15px;
    border-bottom: 1px solid #444;
    padding-bottom: 10px;
}

/* Browse Page */
.browse-page {
    padding: 20px;
}

.browse-section {
    margin-bottom: 30px;
}

.browse-section h2 {
    margin-bottom: 15px;
    border-bottom: 1px solid #444;
    padding-bottom: 10px;
}

/* Error Message */
.error-message {
    background-color: rgba(244, 67, 54, 0.1);
    border-left: 4px solid #F44336;
    padding: 15px;
    margin: 20px 0;
    color: #F44336;
}
`;

// Plugin installation script
function installPlugin() {
    // Create style element
    const styleElement = document.createElement('style');
    styleElement.textContent = pluginStyles + pluginStylesContinued;
    document.head.appendChild(styleElement);
    
    // Create plugin instance
    const plugin = new JellyseerrIntegrationPlugin(
        // Read settings from Jellyfin
        window.Jellyfin.getPluginConfig('JellyfinJellyseerrIntegration')
    );
    
    // Initialize plugin
    plugin.init();
    
    // Store plugin instance in global scope for debugging
    window.jellyfinJellyseerrPlugin = plugin;
    
    console.log('Jellyseerr Integration Plugin installed successfully');
}

// Main plugin configuration file (manifest)
const pluginManifest = {
    name: "JellyfinJellyseerrIntegration",
    displayName: "Jellyseerr Integration",
    version: "1.0.0",
    description: "Integrates Jellyseerr functionality into Jellyfin",
    owner: "Your Name",
    overview: "Browse content by network/studio and request missing content directly from Jellyfin",
    category: "General",
    autoLoad: true,
    dependencies: ["Jellyfin.Api", "Jellyfin.UI"],
    config: {
        options: [
            {
                name: "jellyseerrUrl",
                type: "string",
                label: "Jellyseerr URL",
                defaultValue: "http://localhost:5055",
                required: true,
                helpText: "The URL of your Jellyseerr instance (e.g. http://localhost:5055)"
            },
            {
                name: "jellyseerrApiKey",
                type: "string",
                label: "Jellyseerr API Key",
                defaultValue: "",
                required: true,
                helpText: "Your Jellyseerr API key (can be found in your Jellyseerr user settings)"
            },
            {
                name: "refreshInterval",
                type: "number",
                label: "Refresh Interval (hours)",
                defaultValue: 12,
                required: true,
                helpText: "How often to refresh data from Jellyseerr"
            },
            {
                name: "displayNetworks",
                type: "array",
                elementType: "string",
                label: "Networks to Display",
                defaultValue: ["HBO", "Netflix", "Disney", "Amazon", "Apple TV+", "Hulu", "Paramount+"],
                required: false,
                helpText: "Networks to display on the home screen"
            },
            {
                name: "displayStudios",
                type: "array",
                elementType: "string",
                label: "Studios to Display",
                defaultValue: ["Warner Bros.", "Universal Pictures", "Sony Pictures", "Paramount Pictures"],
                required: false,
                helpText: "Studios to display on the home screen"
            }
        ],
        onSave: function(settings) {
            // Reload plugin with new settings
            if (window.jellyfinJellyseerrPlugin) {
                window.jellyfinJellyseerrPlugin.options = settings;
                window.jellyfinJellyseerrPlugin.refreshData();
            }
        }
    },
    // Files included in the plugin package
    files: [
        {
            name: "plugin.js",
            type: "script"
        },
        {
            name: "images/default-network.png",
            type: "image"
        },
        {
            name: "images/default-studio.png",
            type: "image"
        },
        {
            name: "images/default-movie.png",
            type: "image"
        },
        {
            name: "images/default-tv.png",
            type: "image"
        }
    ]
};

// Initialize plugin when Jellyfin has loaded
document.addEventListener('jellyfin-loaded', installPlugin);

// If Jellyfin is already loaded, install immediately
if (window.Jellyfin) {
    installPlugin();
}

/**
 * API Documentation for Jellyseerr Integration
 * 
 * This plugin uses the following Jellyseerr API endpoints:
 * 
 * 1. GET /api/v1/networks
 *    - Returns a list of all networks
 * 
 * 2. GET /api/v1/studios
 *    - Returns a list of all studios
 * 
 * 3. GET /api/v1/network/{networkId}/content
 *    - Returns movies and TV shows for a specific network
 * 
 * 4. GET /api/v1/studio/{studioId}/content
 *    - Returns movies and TV shows for a specific studio
 * 
 * 5. POST /api/v1/request
 *    - Request a movie or TV show
 *    - Body: { mediaId: number, mediaType: "movie" | "tv" }
 * 
 * 6. GET /api/v1/search/status
 *    - Check if a movie or TV show exists in the library
 *    - Query params: tmdbId, mediaType
 * 
 * The plugin also uses the following Jellyfin Client API interfaces:
 * 
 * 1. Jellyfin.Components.registerHomeSection
 *    - Register a new section on the home screen
 * 
 * 2. Jellyfin.Navigation.navigate
 *    - Navigate to a specific page
 * 
 * 3. Jellyfin.Navigation.registerMenuItem
 *    - Register a new menu item
 * 
 * 4. Jellyfin.getPluginConfig
 *    - Get plugin configuration settings
 */

// Installation Instructions:
/**
 * To install this plugin in Jellyfin:
 * 
 * 1. Create a directory structure like this:
 *    - JellyfinJellyseerrIntegration/
 *      - plugin.js (contains all plugin code)
 *      - plugin.xml (contains plugin manifest info)
 *      - images/
 *        - default-network.png
 *        - default-studio.png
 *        - default-movie.png
 *        - default-tv.png
 * 
 * 2. Create plugin.xml with the following content:
 *    ```xml
 *    <?xml version="1.0" encoding="utf-8"?>
 *    <Plugin xmlns="http://schema.jellyfin.org/plugin/v1" 
 *            id="JellyfinJellyseerrIntegration"
 *            name="Jellyseerr Integration"
 *            description="Integrates Jellyseerr functionality into Jellyfin"
 *            version="1.0.0">
 *        <manifest>
 *            <description>Browse content by network/studio and request missing content directly from Jellyfin</description>
 *            <owner>Your Name</owner>
 *            <category>General</category>
 *            <dependencies>
 *                <dependency id="Jellyfin.Api" version=">=10.7.0" />
 *                <dependency id="Jellyfin.UI" version=">=10.7.0" />
 *            </dependencies>
 *        </manifest>
 *        <assets>
 *            <javascript src="plugin.js" />
 *            <image src="images/default-network.png" />
 *            <image src="images/default-studio.png" />
 *            <image src="images/default-movie.png" />
 *            <image src="images/default-tv.png" />
 *        </assets>
 *    </Plugin>
 *    ```
 * 
 * 3. Zip the JellyfinJellyseerrIntegration directory
 * 
 * 4. In Jellyfin, go to Admin Dashboard > Plugins > Catalog
 * 
 * 5. Click on "Upload Plugin" and select the zip file
 * 
 * 6. Once installed, configure the plugin with your Jellyseerr URL and API key
 * 
 * 7. Restart Jellyfin
 */