/**
 * TeamSheldon Admin Panel - Dashboard JavaScript
 * Domain: admin.teamsheldon.tech
 * Dashboard Management System
 */

class Dashboard {
    constructor() {
        this.API_BASE = 'https://api.teamsheldon.tech';
        
        // Get API key from login session - check both possible keys
        this.API_KEY = localStorage.getItem('adminToken') || localStorage.getItem('authToken');
        
        console.log('🔍 Checking API key availability...');
        console.log('🔑 adminToken from localStorage:', localStorage.getItem('adminToken') ? '[PRESENT]' : '[MISSING]');
        console.log('🔑 authToken from localStorage:', localStorage.getItem('authToken') ? '[PRESENT]' : '[MISSING]');
        console.log('🔑 Using API key:', this.API_KEY ? `[PRESENT] ${this.API_KEY.substring(0, 20)}...` : '[MISSING]');
        
        if (!this.API_KEY) {
            console.error('❌ No valid API key found in session');
            console.log('🔍 API key:', this.API_KEY || '[NULL]');
            this.handleMissingApiKey();
            return; // Don't initialize dashboard without API key
        } else {
            console.log('🔑 API key loaded from session for dashboard use');
            console.log('🔑 Token details:', {
                length: this.API_KEY.length,
                prefix: this.API_KEY.substring(0, 20),
                type: this.API_KEY.startsWith('admin_') ? 'Admin Session Token' : 'Unknown Token Type'
            });
            // Test if the API key is valid
            this.validateApiKey();
        }
        
        this.charts = {};
        this.refreshInterval = null;
        this.cache = new Map(); // Add caching system
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes cache
        
        // Load user info into sidebar
        this.loadUserInfo();
        
        this.init();
    }

    async loadUserInfo() {
        try {
            console.log('👤 Loading user information...');
            
            // First try to get user info from localStorage
            let username = localStorage.getItem('username') || localStorage.getItem('userEmail');
            let userRole = localStorage.getItem('userRole') || 'Administrator';
            let userEmail = localStorage.getItem('userEmail') || localStorage.getItem('username');
            
            // If username contains @, extract the part before @
            if (username && username.includes('@')) {
                const emailParts = username.split('@');
                username = emailParts[0];
                userEmail = username + '@' + emailParts[1];
            }
            
            // Set defaults if nothing found
            if (!username) username = 'Admin User';
            if (!userEmail) userEmail = 'admin@teamsheldon.tech';
            if (!userRole) userRole = 'Administrator';
            
            console.log('📝 User info loaded:', { username, userRole, userEmail });
            
            // Try to fetch fresh user info from API if we have a token
            const token = localStorage.getItem('authToken') || this.getAuthCookie();
            if (token) {
                try {
                    console.log('🔄 Attempting to fetch fresh user info from API...');
                    const response = await fetch(`${this.API_BASE}/api/user/profile`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (response.ok) {
                        const userInfo = await response.json();
                        console.log('✅ Fresh user info from API:', userInfo);
                        
                        // Update with API data
                        username = userInfo.username || userInfo.name || username;
                        userRole = userInfo.role || userInfo.userRole || userRole;
                        userEmail = userInfo.email || userInfo.userEmail || userEmail;
                        
                        // Store updated info
                        localStorage.setItem('username', username);
                        localStorage.setItem('userRole', userRole);
                        localStorage.setItem('userEmail', userEmail);
                        localStorage.setItem('userInfo', JSON.stringify(userInfo));
                    } else {
                        console.log('⚠️ Could not fetch fresh user info, using stored data');
                    }
                } catch (apiError) {
                    console.log('⚠️ API user info fetch failed, using stored data:', apiError.message);
                }
            }
            
            // Update sidebar user info
            this.setElementText('sidebarUserName', username);
            this.setElementText('sidebarUserRole', userRole);
            this.setElementText('sidebarUserEmail', userEmail);
            
            console.log('✅ User info displayed in sidebar');
            
        } catch (error) {
            console.error('❌ Error loading user info:', error);
            // Fallback to safe defaults
            this.setElementText('sidebarUserName', 'Admin User');
            this.setElementText('sidebarUserRole', 'Administrator');
            this.setElementText('sidebarUserEmail', 'admin@teamsheldon.tech');
        }
    }

    async validateApiKey() {
        try {
            console.log('🔍 Validating API key with server...');
            const response = await fetch(`${this.API_BASE}/api/auth/verify`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.API_KEY}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ API key is valid:', data);
            } else {
                console.error('❌ API key validation failed:', response.status, await response.text());
                console.log('🔄 API key appears invalid, logging out user');
                this.handleMissingApiKey();
            }
        } catch (error) {
            console.error('❌ Error validating API key:', error);
        }
    }

    handleMissingApiKey() {
        console.log('🚨 Handling missing API key - logging out user');
        
        // Clear any existing session data - both possible token locations
        localStorage.removeItem('admin_session_active');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('authToken');
        
        // Remove auth cookie
        document.cookie = 'admin_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; secure; samesite=strict';
        
        // Show notification using the unified system
        if (window.notificationManager) {
            window.notificationManager.error('No valid API key found. Please log in again to access the dashboard.', 8000, true);
        } else {
            // Fallback notification
            showNotification('No valid API key found. Please log in again to access the dashboard.', 'error', 8000, true);
        }
        
        // Redirect to login after a short delay
        setTimeout(() => {
            console.log('🔄 Redirecting to login page due to missing API key');
            window.location.href = 'index.html';
        }, 3000);
    }

    async init() {
        console.log('🚀 Initializing Dashboard...');
        
        // Check authentication with better error handling
        const authResult = await this.checkAuth();
        console.log('🔐 Authentication check result:', authResult);
        
        if (!authResult.isValid) {
            console.log('❌ Authentication failed:', authResult.reason);
            this.showNotification('Authentication Error', authResult.reason, 'error');
            
            // Delay redirect to prevent immediate reload loop
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
            return;
        }

        console.log('✅ Authentication successful, loading dashboard...');
        this.setupEventListeners();
        await this.loadDashboardData();
        this.startAutoRefresh();
        this.showNotification('Dashboard Loaded', 'Information loaded successfully', 'success');
    }

    async checkAuth() {
        console.log('🔐 Starting authentication check...');
        
        // For development/testing, always allow access when on localhost
        const isDevelopment = window.location.hostname === 'localhost' || 
                            window.location.hostname === '127.0.0.1' ||
                            window.location.port === '3000' ||
                            window.location.protocol === 'file:';

        if (isDevelopment) {
            console.log('🚧 Development environment detected - bypassing authentication');
            return { isValid: true, reason: 'Development mode - authentication bypassed' };
        }
        
        const token = this.getAuthCookie();
        console.log('🍪 Token found:', token ? 'Yes (length: ' + token.length + ')' : 'No');
        
        // If no token, authentication failed
        if (!token) {
            console.log('❌ No authentication token found');
            return { isValid: false, reason: 'No authentication token found' };
        }

        // Token exists, authentication valid
        console.log('✅ Token exists, authentication valid');
        return { isValid: true, reason: 'Token exists' };
    }

    getAuthCookie() {
        const name = 'admin_token=';
        const decodedCookie = decodeURIComponent(document.cookie);
        const cookieArray = decodedCookie.split(';');
        
        for (let i = 0; i < cookieArray.length; i++) {
            let cookie = cookieArray[i];
            while (cookie.charAt(0) === ' ') {
                cookie = cookie.substring(1);
            }
            if (cookie.indexOf(name) === 0) {
                return cookie.substring(name.length, cookie.length);
            }
        }
        return null;
    }

    // Cache management methods
    getCachedData(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            console.log('📦 Using cached data for:', key);
            return cached.data;
        }
        return null;
    }

    setCachedData(key, data) {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    async cachedFetch(url, options, cacheKey) {
        // Check cache first
        const cached = this.getCachedData(cacheKey);
        if (cached) {
            return { ok: true, json: () => Promise.resolve(cached) };
        }

        try {
            const response = await fetch(url, options);
            if (response.ok) {
                const data = await response.json();
                this.setCachedData(cacheKey, data);
                return { ok: true, json: () => Promise.resolve(data) };
            }
            return response;
        } catch (error) {
            console.warn('Fetch error for', cacheKey, ':', error.message);
            return { ok: false, status: 500 };
        }
    }

    setupEventListeners() {
        // Sidebar toggle
        const sidebarToggle = document.getElementById('sidebarToggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => this.toggleSidebar());
        }
        
        // Burger menu button (for when sidebar is hidden)
        const burgerMenuBtn = document.getElementById('burgerMenuBtn');
        if (burgerMenuBtn) {
            burgerMenuBtn.addEventListener('click', () => this.toggleSidebar());
            // Initially hide burger menu since sidebar is visible by default
            burgerMenuBtn.style.display = 'none';
        }

        // Window resize handler
        window.addEventListener('resize', () => this.handleResize());
        
        // Setup ResizeObserver for chart containers to detect layout changes
        this.setupChartResizeObserver();
    }

    setupChartResizeObserver() {
        if (typeof ResizeObserver === 'undefined') {
            console.log('ResizeObserver not supported, using fallback');
            return;
        }

        // Create ResizeObserver to watch chart containers
        this.resizeObserver = new ResizeObserver((entries) => {
            console.log('📊 Chart containers resized, triggering chart update');
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => {
                this.handleResize();
            }, 100);
        });

        // Observe chart containers
        setTimeout(() => {
            const chartContainers = document.querySelectorAll('.chart-container');
            chartContainers.forEach(container => {
                this.resizeObserver.observe(container);
                console.log('👁️ Observing chart container for size changes');
            });
        }, 1000); // Wait for charts to be created
    }

    toggleSidebar() {
        const sidebar = document.getElementById('dashboardSidebar');
        const sidebarToggle = document.getElementById('sidebarToggle');
        const burgerMenuBtn = document.getElementById('burgerMenuBtn');
        const dashboardContainer = document.querySelector('.dashboard-container');
        
        if (sidebar) {
            // Toggle between hidden and visible instead of collapsed
            sidebar.classList.toggle('hidden');
            const isHidden = sidebar.classList.contains('hidden');
            console.log('Sidebar toggled. Hidden:', isHidden);
            
            // Add/remove expanded class to dashboard container
            if (dashboardContainer) {
                dashboardContainer.classList.toggle('sidebar-hidden', isHidden);
            }
            
            // Update burger menu visibility
            if (burgerMenuBtn) {
                burgerMenuBtn.style.display = isHidden ? 'flex' : 'none';
                console.log('Burger menu button:', isHidden ? 'shown' : 'hidden');
            }
            
            // Update toggle button icon in sidebar
            if (sidebarToggle) {
                const icon = sidebarToggle.querySelector('i');
                if (icon) {
                    if (isHidden) {
                        icon.className = 'fas fa-bars';
                    } else {
                        icon.className = 'fas fa-times';
                    }
                }
            }

            // Resize charts after transition completes - multiple attempts
            setTimeout(() => {
                // Trigger a window resize event to force all responsive elements to recalculate
                window.dispatchEvent(new Event('resize'));
                this.handleResize();
                console.log('📊 First chart resize attempt after sidebar toggle');
            }, 350);
            
            // Second resize attempt to ensure it worked
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
                this.handleResize();
                console.log('📊 Second chart resize attempt for safety');
            }, 600);
            
            // Third attempt with more delay
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
                this.handleResize();
                console.log('📊 Third chart resize attempt (final)');
            }, 1000);
        } else {
            console.error('Sidebar element not found');
        }
    }

    handleResize() {
        // Force a complete chart resize and redraw
        console.log('📊 Forcing chart resize...');
        
        // First, let the DOM settle
        setTimeout(() => {
            Object.entries(this.charts).forEach(([name, chart]) => {
                if (chart && chart.canvas) {
                    try {
                        console.log(`🔄 Resizing ${name} chart...`);
                        
                        // Get the container element
                        const container = chart.canvas.parentElement;
                        if (container) {
                            // Force container to recalculate its size
                            const containerStyle = getComputedStyle(container);
                            const newWidth = container.offsetWidth - parseInt(containerStyle.paddingLeft) - parseInt(containerStyle.paddingRight);
                            const newHeight = 300; // Fixed height as per CSS
                            
                            console.log(`📏 Container dimensions: ${newWidth}x${newHeight}`);
                            
                            // Set canvas dimensions explicitly
                            chart.canvas.style.width = newWidth + 'px';
                            chart.canvas.style.height = newHeight + 'px';
                            
                            // Force Chart.js to resize
                            chart.resize(newWidth, newHeight);
                            chart.update('none');
                            
                            console.log(`✅ ${name} chart resized to ${newWidth}x${newHeight}`);
                        }
                    } catch (error) {
                        console.error(`❌ Error resizing ${name} chart:`, error);
                    }
                }
            });
        }, 50); // Small delay to let DOM settle
    }

    async loadDashboardData() {
        try {
            console.log('🚀 Starting dashboard data loading...');
            
            // Load statistics first as they're most important
            console.log('📊 Loading statistics...');
            await this.loadStatistics();
            
            // Load other components
            console.log('📈 Loading charts...');
            await this.loadCharts();
            
            console.log('📋 Loading recent activity...');
            await this.loadRecentActivity();
            
            console.log('🛡️ Loading security alerts...');
            await this.loadSecurityAlerts();
            
            console.log('⚙️ Checking system status...');
            await this.checkSystemStatus();
            
            console.log('✅ Dashboard data loading completed');
        } catch (error) {
            console.error('❌ Dashboard loading error:', error);
            if (window.notificationManager) {
                window.notificationManager.error('Loading Error: Some dashboard data could not be loaded', 5000, false);
            }
        }
    }

    async loadStatistics() {
        console.log('📊 Loading dashboard statistics...');
        
        // Set default values first
        this.setElementText('totalTeams', 'Loading...');
        this.setElementText('teamsToday', 'Loading...');
        this.setElementText('totalWhiteboards', 'Loading...');
        this.setElementText('whiteboardsToday', 'Loading...');
        this.setElementText('totalLogins', 'Loading...');
        this.setElementText('loginsToday', 'Loading...');
        this.setElementText('failedLogins', 'Loading...');
        this.setElementText('failedLoginsToday', 'Loading...');

        const headers = this.getHeaders();

        // Try to use new comprehensive admin dashboard API first
        try {
            console.log('🚀 Attempting to load comprehensive dashboard statistics from admin API...');
            const dashboardResponse = await this.safeFetch(`${this.API_BASE}/api/admin/dashboard`, { headers });
            
            if (dashboardResponse.success && dashboardResponse.data && dashboardResponse.data.statistics) {
                console.log('✅ Successfully loaded comprehensive dashboard data');
                this.processDashboardStats(dashboardResponse.data);
                return;
            } else {
                console.log('⚠️ Admin dashboard API response not successful, falling back to individual endpoints');
            }
        } catch (adminApiError) {
            console.log('⚠️ Admin dashboard API not available, falling back to individual endpoints:', adminApiError.message);
        }

        // Fallback to individual API endpoints
        console.log('📡 Loading statistics from individual endpoints...');
        
        // Load Teams Data
        await this.loadTeamsStatistics(headers);
        
        // Load Whiteboards Data
        await this.loadWhiteboardsStatistics(headers);
        
        // Load Login History Data
        await this.loadLoginStatistics(headers);
    }

    processDashboardStats(dashboardData) {
        console.log('🎯 Processing comprehensive dashboard statistics:', dashboardData);
        
        const stats = dashboardData.statistics;
        const monitoring = dashboardData.monitoring;
        const analytics = dashboardData.analytics;
        
        // Update user statistics
        if (stats.users) {
            this.setElementText('totalUsers', stats.users.total.toString());
            this.setElementText('activeUsers', stats.users.active.toString());
            this.setElementText('newUsersToday', `${stats.users.newToday} today`);
        }
        
        // Update login statistics
        if (stats.logins) {
            this.setElementText('totalLogins', stats.logins.total.toString());
            this.setElementText('loginsToday', `${stats.logins.today} today`);
            this.setElementText('failedLogins', stats.logins.totalFailed.toString());
            this.setElementText('failedLoginsToday', `${stats.logins.failedToday} today`);
        }
        
        // Update team statistics (if available)
        if (stats.teams) {
            this.setElementText('totalTeams', stats.teams.total.toString());
            this.setElementText('teamsToday', `${stats.teams.newToday} today`);
        }
        
        // Update whiteboard statistics (if available)
        if (stats.whiteboards) {
            this.setElementText('totalWhiteboards', stats.whiteboards.total.toString());
            this.setElementText('whiteboardsToday', `${stats.whiteboards.newToday} today`);
        }
        
        // Update monitoring data
        if (monitoring) {
            // Update system health indicators
            const healthElement = document.getElementById('systemHealth');
            if (healthElement && monitoring.systemHealth) {
                const healthStatus = monitoring.systemHealth.overall;
                healthElement.textContent = healthStatus;
                healthElement.className = `status-indicator ${healthStatus.toLowerCase()}`;
            }
            
            // Update security alerts
            if (monitoring.security) {
                const alertsElement = document.getElementById('securityAlerts');
                if (alertsElement) {
                    const alertCount = monitoring.security.activeThreats || 0;
                    alertsElement.textContent = alertCount.toString();
                    alertsElement.className = alertCount > 0 ? 'alert-count warning' : 'alert-count safe';
                }
            }
        }
        
        // Update analytics data for charts if available
        if (analytics) {
            this.analyticsData = analytics;
            // Trigger chart updates with new data
            this.updateChartsWithAnalytics(analytics);
        }
        
        console.log('✅ Comprehensive dashboard statistics processed successfully');
    }

    updateChartsWithAnalytics(analyticsData) {
        console.log('📊 Updating charts with analytics data:', analyticsData);
        
        // Update login trend chart
        if (analyticsData.loginTrends && this.charts.loginTrend) {
            const trendData = analyticsData.loginTrends.slice(-30); // Last 30 days
            this.charts.loginTrend.data.labels = trendData.map(d => new Date(d.date).toLocaleDateString());
            this.charts.loginTrend.data.datasets[0].data = trendData.map(d => d.count);
            this.charts.loginTrend.update();
        }
        
        // Update user activity chart
        if (analyticsData.userActivity && this.charts.userActivity) {
            this.charts.userActivity.data.datasets[0].data = [
                analyticsData.userActivity.active,
                analyticsData.userActivity.inactive
            ];
            this.charts.userActivity.update();
        }
        
        console.log('✅ Charts updated with analytics data');
    }

    async loadTeamsStatistics(headers) {
        try {
            console.log('🏃‍♂️ Loading teams data from:', `${this.API_BASE}/api/teams`);
            console.log('🔧 Using headers:', Object.keys(headers));
            
            const response = await this.safeFetch(`${this.API_BASE}/api/teams`, { headers });
            console.log('🏃‍♂️ Teams API full response:', response);
            
            if (response.success) {
                const teamsData = response.data;
                console.log('🏃‍♂️ Teams raw data:', teamsData);
                console.log('🏃‍♂️ Teams data type:', typeof teamsData);
                
                let totalTeams = 0;
                
                // Handle different possible response structures
                if (Array.isArray(teamsData)) {
                    totalTeams = teamsData.length;
                    console.log('📊 Teams data is array, count:', totalTeams);
                } else if (teamsData && typeof teamsData === 'object') {
                    // Check if it's an object with teams property
                    if (teamsData.teams && Array.isArray(teamsData.teams)) {
                        totalTeams = teamsData.teams.length;
                        console.log('📊 Teams data has teams property (array), count:', totalTeams);
                    } else if (teamsData.count !== undefined) {
                        totalTeams = parseInt(teamsData.count) || 0;
                        console.log('📊 Teams data has count property:', totalTeams);
                    } else if (teamsData.total !== undefined) {
                        totalTeams = parseInt(teamsData.total) || 0;
                        console.log('📊 Teams data has total property:', totalTeams);
                    } else if (teamsData.length !== undefined) {
                        totalTeams = parseInt(teamsData.length) || 0;
                        console.log('📊 Teams data has length property:', totalTeams);
                    } else {
                        // Count object properties as teams
                        totalTeams = Object.keys(teamsData).length;
                        console.log('📊 Teams data is object, counting keys:', totalTeams);
                    }
                } else if (typeof teamsData === 'number') {
                    totalTeams = teamsData;
                    console.log('📊 Teams data is number:', totalTeams);
                }
                
                const teamsToday = this.getItemsToday(Array.isArray(teamsData) ? teamsData : 
                    (teamsData && teamsData.teams) ? teamsData.teams : []);
                
                this.setElementText('totalTeams', totalTeams.toString());
                this.setElementText('teamsToday', `${teamsToday} today`);
                console.log('✅ Teams data loaded:', totalTeams, 'teams,', teamsToday, 'today');
            } else {
                const errorMsg = response.error === 'rate_limit' ? 'Rate Limited' : 'Error';
                this.setElementText('totalTeams', errorMsg);
                this.setElementText('teamsToday', 'Error');
                console.warn('⚠️ Teams API error:', response.message);
                console.warn('⚠️ Teams API full response:', response);
                
                // Additional debugging for teams endpoint
                if (response.message && response.message.includes('404')) {
                    console.error('🔍 Teams endpoint not found - check if /api/teams exists on server');
                } else if (response.message && (response.message.includes('401') || response.message.includes('403'))) {
                    console.error('🔐 Teams endpoint authentication issue - may need different headers');
                }
            }
        } catch (error) {
            console.error('❌ Teams loading failed:', error);
            this.setElementText('totalTeams', 'Error');
            this.setElementText('teamsToday', 'Error');
        }
    }

    async loadWhiteboardsStatistics(headers) {
        try {
            console.log('📋 Loading whiteboards data from:', `${this.API_BASE}/api/whiteboards`);
            const response = await this.safeFetch(`${this.API_BASE}/api/whiteboards`, { headers });
            
            if (response.success) {
                const whiteboardsData = response.data;
                const totalWhiteboards = Array.isArray(whiteboardsData) ? whiteboardsData.length : 0;
                const whiteboardsToday = this.getItemsToday(whiteboardsData);
                
                this.setElementText('totalWhiteboards', totalWhiteboards.toString());
                this.setElementText('whiteboardsToday', `${whiteboardsToday} today`);
                console.log('✅ Whiteboards data loaded:', totalWhiteboards, 'whiteboards');
            } else {
                this.setElementText('totalWhiteboards', response.error === 'rate_limit' ? 'Rate Limited' : 'Error');
                this.setElementText('whiteboardsToday', 'Error');
                console.warn('⚠️ Whiteboards API error:', response.message);
            }
        } catch (error) {
            console.error('❌ Whiteboards loading failed:', error);
            this.setElementText('totalWhiteboards', 'Error');
            this.setElementText('whiteboardsToday', 'Error');
        }
    }

    async loadLoginStatistics(headers) {
        try {
            console.log('🔐 Loading login history from:', `${this.API_BASE}/api/login-history`);
            console.log('🔍 Current API_KEY:', this.API_KEY ? `[${this.API_KEY.length} chars] ${this.API_KEY.substring(0, 20)}...` : '[NULL]');
            
            // Use headers with API key for login-history endpoint
            const headersWithApiKey = this.getHeaders(true);
            console.log('🔑 Using headers:', Object.keys(headersWithApiKey));
            console.log('🔑 Authorization header:', headersWithApiKey.Authorization ? `${headersWithApiKey.Authorization.substring(0, 20)}...` : '[MISSING]');
            
            const response = await this.safeFetch(`${this.API_BASE}/api/login-history`, { headers: headersWithApiKey });
            console.log('📡 Login history API response:', response);
            
            if (response.success) {
                const serverResponse = response.data; // This is { history: [...], stats: {...} }
                const loginData = serverResponse.history || [];
                
                console.log('📊 SERVER RESPONSE STRUCTURE:', {
                    hasHistory: !!serverResponse.history,
                    hasStats: !!serverResponse.stats,
                    historyLength: serverResponse.history ? serverResponse.history.length : 0,
                    statsContent: serverResponse.stats
                });
                
                console.log('📊 Raw login data:', loginData);
                console.log('📊 Login data type:', typeof loginData, 'Is Array:', Array.isArray(loginData));
                console.log('📊 Login data length:', Array.isArray(loginData) ? loginData.length : 'Not array');
                
                if (Array.isArray(loginData) && loginData.length > 0) {
                    console.log('📊 Sample login entry:', loginData[0]);
                    console.log('📊 Sample fields:', {
                        hasTimestamp: !!loginData[0].timestamp,
                        hasCreatedAt: !!loginData[0].createdAt,
                        hasSuccess: typeof loginData[0].success !== 'undefined',
                        timestampValue: loginData[0].timestamp,
                        successValue: loginData[0].success
                    });
                }
                
                const totalLogins = Array.isArray(loginData) ? loginData.length : 0;
                console.log('📊 RAW LOGIN DATA SAMPLE:', loginData.slice(0, 3));
                console.log('📊 TOTAL LOGIN ENTRIES:', totalLogins);
                
                // Check if server provided statistics
                const serverStats = serverResponse.stats || {};
                console.log('📊 Server statistics available:', {
                    hasStats: !!serverResponse.stats,
                    serverTotal: serverStats.total,
                    serverFailed: serverStats.failed,
                    serverToday: serverStats.today,
                    clientTotal: totalLogins
                });

                const loginsToday = this.getItemsToday(loginData);
                
                // Use server statistics when available, fallback to client calculation
                let finalTotalLogins, finalFailedLogins;
                
                if (serverStats.total !== undefined && serverStats.failed !== undefined) {
                    finalTotalLogins = serverStats.total;
                    finalFailedLogins = serverStats.failed;
                    console.log('📊 Using server-calculated statistics:', {
                        total: finalTotalLogins,
                        failed: finalFailedLogins
                    });
                } else {
                    // Fallback to client calculation with detailed debugging
                    finalTotalLogins = totalLogins;
                    
                    console.log('📊 FAILED LOGIN ANALYSIS (Client Calculation):');
                    const failedBySuccess = loginData.filter(login => login.success === false);
                    const failedByFailed = loginData.filter(login => login.failed === true);
                    const failedByError = loginData.filter(login => login.error);
                    const failedByStatus = loginData.filter(login => login.status === 'failed');
                    
                    console.log('  - success === false:', failedBySuccess.length);
                    console.log('  - failed === true:', failedByFailed.length);
                    console.log('  - has error field:', failedByError.length);
                    console.log('  - status === failed:', failedByStatus.length);
                    
                    finalFailedLogins = Array.isArray(loginData) ? 
                        loginData.filter(login => 
                            login.success === false || login.failed === true || 
                            login.error || login.status === 'failed'
                        ).length : 0;
                        
                    console.log('📊 CLIENT CALCULATED FAILED LOGINS:', finalFailedLogins);
                }
                
                // Sample some failed entries to understand the data structure
                const failedEntries = loginData.filter(login => 
                    login.success === false || login.failed === true || 
                    login.error || login.status === 'failed'
                );
                console.log('📊 SAMPLE FAILED ENTRIES:', failedEntries.slice(0, 3));
                
                const failedLoginsToday = this.getItemsToday(failedEntries);
                
                console.log(`📊 FINAL STATS:`, {
                    totalLogins: finalTotalLogins,
                    loginsToday,
                    failedLogins: finalFailedLogins,
                    failedLoginsToday
                });
                
                this.setElementText('totalLogins', finalTotalLogins.toString());
                this.setElementText('loginsToday', `${loginsToday} today`);
                this.setElementText('failedLogins', finalFailedLogins.toString());
                this.setElementText('failedLoginsToday', `${failedLoginsToday} today`);
                console.log('✅ Login history loaded:', finalTotalLogins, 'total logins,', finalFailedLogins, 'failed');
            } else {
                console.error('❌ Login history API failed:', response);
                const errorMsg = response.error === 'rate_limit' ? 'Rate Limited' : 
                               (response.message && (response.message.includes('401') || response.message.includes('403'))) ? 'Auth Failed' : 'API Error';
                               
                this.setElementText('totalLogins', errorMsg);
                this.setElementText('loginsToday', 'Error');
                this.setElementText('failedLogins', errorMsg);
                this.setElementText('failedLoginsToday', 'Error');
                console.warn('⚠️ Login history API error:', response.message);
                
                if (errorMsg === 'Auth Failed') {
                    console.error('🔑 Authentication failed - token may be invalid or expired');
                    if (window.notificationManager) {
                        window.notificationManager.error('Authentication failed. Please log in again to view login statistics.', 8000, false);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Login history loading failed:', error);
            this.setElementText('totalLogins', 'Error');
            this.setElementText('loginsToday', 'Error');
            this.setElementText('failedLogins', 'Error');
            this.setElementText('failedLoginsToday', 'Error');
        }
    }

    // Helper method to safely set element text
    setElementText(id, text) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = text;
        } else {
            console.warn('Element not found:', id);
        }
    }

    // Helper method to get appropriate headers
    getHeaders(requiresApiKey = false) {
        const token = this.getAuthCookie();
        const headers = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        };
        
        // Add API key for endpoints that require it (like login-history)
        if (requiresApiKey) {
            if (!this.API_KEY) {
                console.error('🔑 API key required but not available - redirecting to login');
                this.handleMissingApiKey();
                return headers;
            }
            // Server expects the session token in Authorization header as Bearer token
            headers['Authorization'] = `Bearer ${this.API_KEY}`;
            console.log('🔑 Added API key to headers as Bearer token');
        }
        
        return headers;
    }

    // Safer fetch method with better error handling
    async safeFetch(url, options) {
        try {
            console.log('🌐 Fetching:', url);
            const response = await fetch(url, {
                ...options,
                mode: 'cors'
            });

            console.log('📡 Response status:', response.status, response.statusText);

            if (response.status === 429) {
                return { 
                    success: false, 
                    error: 'rate_limit', 
                    message: 'Rate limited' 
                };
            }

            if (response.ok) {
                const data = await response.json();
                console.log('✅ API Response successful, data length:', Array.isArray(data) ? data.length : 'Not array');
                return { 
                    success: true, 
                    data: data 
                };
            } else {
                const errorText = await response.text();
                console.warn('⚠️ API Error response:', response.status, errorText);
                return { 
                    success: false, 
                    error: 'api_error', 
                    message: `HTTP ${response.status}: ${response.statusText}` 
                };
            }
        } catch (error) {
            console.error('❌ Network error:', error);
            return { 
                success: false, 
                error: 'network_error', 
                message: error.message 
            };
        }
    }

    getItemsToday(items) {
        if (!Array.isArray(items)) {
            console.log('📊 getItemsToday: Not an array, returning 0');
            return 0;
        }
        
        const today = new Date().toDateString();
        console.log('📊 getItemsToday: Checking for items from today:', today);
        console.log('📊 getItemsToday: Total items to check:', items.length);
        
        const todayItems = items.filter(item => {
            // Check multiple possible timestamp fields
            const timestamp = item.timestamp || item.createdAt || item.created_at || item.date;
            if (timestamp) {
                const itemDate = new Date(timestamp);
                const isToday = itemDate.toDateString() === today;
                if (isToday) {
                    console.log('📊 Found today item:', { timestamp, itemDate: itemDate.toDateString() });
                }
                return isToday;
            }
            return false;
        });
        
        console.log(`📊 getItemsToday: Found ${todayItems.length} items from today`);
        return todayItems.length;
    }

    async loadCharts() {
        console.log('📊 Loading dashboard charts...');
        this.hideChartLoading();
        await Promise.all([
            this.createActivityChart(),
            this.createGeographicChart()
        ]);
    }

    hideChartLoading() {
        const activityLoading = document.getElementById('activityLoading');
        const geographicLoading = document.getElementById('geographicLoading');
        
        if (activityLoading) activityLoading.style.display = 'none';
        if (geographicLoading) geographicLoading.style.display = 'none';
    }

    async createActivityChart() {
        const ctx = document.getElementById('activityChart');
        if (!ctx) {
            console.warn('Activity chart canvas not found');
            return;
        }

        console.log('📈 Creating enhanced activity chart with teams, whiteboards, and logins...');
        
        let labels = [];
        let loginData = [];
        let teamsData = [];
        let whiteboardsData = [];
        
        try {
            // Get data from multiple sources
            const [loginResponse, teamsResponse, whiteboardsResponse] = await Promise.all([
                this.safeFetch(`${this.API_BASE}/api/login-history`, { headers: this.getHeaders(true) }),
                this.safeFetch(`${this.API_BASE}/api/teams`, { headers: this.getHeaders() }),
                this.safeFetch(`${this.API_BASE}/api/whiteboards`, { headers: this.getHeaders() })
            ]);
            // Process login data
            if (loginResponse.success && loginResponse.data && Array.isArray(loginResponse.data.history)) {
                const loginHistory = loginResponse.data.history;
                console.log('📈 Processing activity chart with', loginHistory.length, 'login entries');
                
                // Process last 7 days for logins
                for (let i = 6; i >= 0; i--) {
                    const date = new Date();
                    date.setDate(date.getDate() - i);
                    const dateStr = date.toDateString();
                    
                    if (i === 6) {
                        labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
                    }
                    
                    // Count logins for this day
                    const dayLoginCount = loginHistory.filter(login => {
                        if (login.timestamp || login.created_at || login.date) {
                            const loginDate = new Date(login.timestamp || login.created_at || login.date);
                            return loginDate.toDateString() === dateStr;
                        }
                        return false;
                    }).length;
                    
                    loginData.push(dayLoginCount);
                }
            } else {
                // Fallback for login data
                for (let i = 6; i >= 0; i--) {
                    const date = new Date();
                    date.setDate(date.getDate() - i);
                    if (i === 6) {
                        labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
                    }
                    loginData.push(0);
                }
            }

            // Ensure we have all 7 labels
            if (labels.length === 1) {
                labels = [];
                for (let i = 6; i >= 0; i--) {
                    const date = new Date();
                    date.setDate(date.getDate() - i);
                    labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
                }
            }

            // Process teams data
            if (teamsResponse.success && Array.isArray(teamsResponse.data)) {
                const teams = teamsResponse.data;
                console.log('� Processing', teams.length, 'teams for activity chart');
                
                // Count teams created each day
                for (let i = 6; i >= 0; i--) {
                    const date = new Date();
                    date.setDate(date.getDate() - i);
                    const dateStr = date.toDateString();
                    
                    const dayTeamCount = teams.filter(team => {
                        if (team.createdAt || team.created_at || team.timestamp) {
                            const teamDate = new Date(team.createdAt || team.created_at || team.timestamp);
                            return teamDate.toDateString() === dateStr;
                        }
                        return false;
                    }).length;
                    
                    teamsData.push(dayTeamCount);
                }
            } else {
                teamsData = new Array(7).fill(0);
            }

            // Process whiteboards data
            if (whiteboardsResponse.success && Array.isArray(whiteboardsResponse.data)) {
                const whiteboards = whiteboardsResponse.data;
                console.log('📈 Processing', whiteboards.length, 'whiteboards for activity chart');
                
                // Count whiteboards created each day
                for (let i = 6; i >= 0; i--) {
                    const date = new Date();
                    date.setDate(date.getDate() - i);
                    const dateStr = date.toDateString();
                    
                    const dayWhiteboardCount = whiteboards.filter(wb => {
                        if (wb.createdAt || wb.created_at || wb.timestamp) {
                            const wbDate = new Date(wb.createdAt || wb.created_at || wb.timestamp);
                            return wbDate.toDateString() === dateStr;
                        }
                        return false;
                    }).length;
                    
                    whiteboardsData.push(dayWhiteboardCount);
                }
            } else {
                whiteboardsData = new Array(7).fill(0);
            }

            console.log('✅ Activity chart data processed:', {
                labels,
                logins: loginData,
                teams: teamsData,
                whiteboards: whiteboardsData
            });
        } catch (error) {
            console.error('❌ Activity chart data loading error:', error);
            // Error loading - show error state with basic labels
            labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            loginData = [0, 0, 0, 0, 0, 0, 0];
            teamsData = [0, 0, 0, 0, 0, 0, 0];
            whiteboardsData = [0, 0, 0, 0, 0, 0, 0];
        }

        // Create the enhanced chart
        if (this.charts.activity) {
            this.charts.activity.destroy();
        }

        this.charts.activity = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Login Activity',
                        data: loginData,
                        borderColor: '#1a73e8',
                        backgroundColor: 'rgba(26, 115, 232, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#1a73e8',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 5
                    },
                    {
                        label: 'Teams Created',
                        data: teamsData,
                        borderColor: '#34a853',
                        backgroundColor: 'rgba(52, 168, 83, 0.1)',
                        borderWidth: 3,
                        fill: false,
                        tension: 0.4,
                        pointBackgroundColor: '#34a853',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 5
                    },
                    {
                        label: 'Whiteboards Created',
                        data: whiteboardsData,
                        borderColor: '#ea4335',
                        backgroundColor: 'rgba(234, 67, 53, 0.1)',
                        borderWidth: 3,
                        fill: false,
                        tension: 0.4,
                        pointBackgroundColor: '#ea4335',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            color: '#ffffff'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Daily Activity Overview',
                        color: '#ffffff',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#b8bcc8'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#b8bcc8',
                            stepSize: 1
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
        
        console.log('✅ Enhanced activity chart created successfully');
    }

    async createGeographicChart() {
        const ctx = document.getElementById('geographicChart');
        if (!ctx) {
            console.warn('Geographic chart canvas not found');
            return;
        }

        console.log('🌍 Creating geographic chart with real login location data...');
        let labels = ['No Data'];
        let data = [1];
        let backgroundColor = ['#e0e0e0'];

        try {
            // Use login history to get real geographic data
            const response = await this.safeFetch(`${this.API_BASE}/api/login-history`, { headers: this.getHeaders(true) });
            
            if (response.success && response.data && Array.isArray(response.data.history)) {
                const loginHistory = response.data.history;
                console.log('🌍 Processing', loginHistory.length, 'login entries for geographic data');
                
                // Debug: Log sample entries to understand data structure
                if (loginHistory.length > 0) {
                    console.log('🔍 Sample login entries for location analysis:');
                    loginHistory.slice(0, 5).forEach((login, i) => {
                        console.log(`  Entry ${i + 1}:`, {
                            hasLocation: !!login.location,
                            locationObj: login.location,
                            country: login.country,
                            city: login.city,
                            region: login.region,
                            ip: login.ip,
                            allKeys: Object.keys(login)
                        });
                    });
                }
                
                // Count logins by country - handle all possible location formats
                const countryCount = {};
                let unprocessedCount = 0;
                
                loginHistory.forEach((login, index) => {
                    let country = null;
                    
                    // Try multiple ways to get country information
                    if (login.location && login.location.country) {
                        country = login.location.country;
                    } else if (login.country) {
                        country = login.country;
                    } else if (login.location && login.location.countryCode) {
                        country = login.location.countryCode;
                    } else if (login.countryCode) {
                        country = login.countryCode;
                    } else if (login.location && typeof login.location === 'string') {
                        // Handle cases where location is a string
                        country = login.location;
                    } else {
                        // Handle entries with no location data
                        country = 'Unknown/Unspecified';
                        unprocessedCount++;
                        if (index < 3) { // Log first few unprocessed entries
                            console.log(`🔍 Unprocessed entry ${index + 1}:`, login);
                        }
                    }
                    
                    if (country) {
                        countryCount[country] = (countryCount[country] || 0) + 1;
                    }
                });

                console.log('🌍 Geographic data analysis:', {
                    totalEntries: loginHistory.length,
                    processedEntries: Object.values(countryCount).reduce((sum, count) => sum + count, 0),
                    unprocessedCount: unprocessedCount,
                    countryCounts: countryCount
                });

                // Convert to chart data
                const sortedCountries = Object.entries(countryCount)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6); // Show top 6 countries

                if (sortedCountries.length > 0) {
                    labels = sortedCountries.map(([country, count]) => `${country} (${count})`);
                    data = sortedCountries.map(([country, count]) => count);
                    
                    // Generate colors for countries
                    const colors = [
                        '#1a73e8', // Primary blue
                        '#34a853', // Green  
                        '#ea4335', // Red
                        '#fbbc04', // Yellow
                        '#9aa0a6', // Grey
                        '#673ab7'  // Purple
                    ];
                    backgroundColor = colors.slice(0, data.length);
                    
                    console.log('✅ Geographic chart data created from login locations:', {
                        countries: labels,
                        counts: data
                    });
                } else {
                    console.log('⚠️ No location data found in login history');
                    // Fallback to generic data
                    labels = ['Unknown Locations'];
                    data = [loginHistory.length];
                    backgroundColor = ['#9aa0a6'];
                }
            } else {
                console.log('⚠️ No login history data available for geographic chart');
            }
        } catch (error) {
            console.error('❌ Geographic chart data loading error:', error);
            // Keep default "No Data" state
        }

        // Create the chart
        if (this.charts.geographic) {
            this.charts.geographic.destroy();
        }

        this.charts.geographic = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColor,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
        
        console.log('✅ Geographic chart created successfully');
    }

    async loadRecentActivity() {
        console.log('📋 Loading recent activity...');
        const container = document.getElementById('recentActivity');
        
        if (!container) {
            console.warn('Recent activity container not found');
            return;
        }

        container.innerHTML = '<div class="loading">Loading recent activity...</div>';
        const headers = this.getHeaders(true); // Require API key for login-history

        try {
            const response = await this.safeFetch(`${this.API_BASE}/api/login-history`, { headers });

            if (response.success && response.data && Array.isArray(response.data.history)) {
                const recentItems = response.data.history.slice(-5).reverse(); // Get last 5 items
                
                if (recentItems.length === 0) {
                    container.innerHTML = '<div class="no-data">No recent activity</div>';
                } else {
                    container.innerHTML = recentItems.map(item => `
                        <div class="activity-item">
                            <div class="activity-icon">
                                <i class="fas ${item.success !== false ? 'fa-sign-in-alt' : 'fa-exclamation-triangle'}"></i>
                            </div>
                            <div class="activity-info">
                                <p class="activity-title">${item.success !== false ? 'Successful Login' : 'Failed Login Attempt'}</p>
                                <p class="activity-time">${this.formatTime(item.timestamp || item.date || Date.now())}</p>
                                <p class="activity-details">${item.username || item.user || 'Unknown User'}</p>
                            </div>
                        </div>
                    `).join('');
                }
                console.log('✅ Recent activity loaded:', recentItems.length, 'items');
            } else {
                container.innerHTML = `<div class="no-data">${response.error === 'rate_limit' ? 'Rate Limited' : 'Error loading activity'}</div>`;
                console.warn('⚠️ Recent activity error:', response.message);
            }
        } catch (error) {
            console.error('❌ Recent activity loading failed:', error);
            container.innerHTML = '<div class="no-data">Error loading activity</div>';
        }
    }

    async loadSecurityAlerts() {
        console.log('🛡️ Loading security alerts...');
        const container = document.getElementById('securityAlerts');
        
        if (!container) {
            console.warn('Security alerts container not found');
            return;
        }

        container.innerHTML = '<div class="loading">Loading security alerts...</div>';
        const headers = this.getHeaders(true); // Require API key for login-history
        
        try {
            // Try to get failed login attempts as security alerts
            const response = await this.safeFetch(`${this.API_BASE}/api/login-history`, { headers });
            
            if (response.success && response.data && Array.isArray(response.data.history)) {
                const loginHistory = response.data.history;
                console.log('🛡️ Processing', loginHistory.length, 'login entries for security alerts');
                
                // Get failed login attempts with multiple criteria
                const failedAttempts = loginHistory.filter(login => 
                    login.success === false || login.failed === true || 
                    login.error || login.status === 'failed'
                );
                
                // Group by IP to find suspicious patterns
                const ipCounts = {};
                failedAttempts.forEach(attempt => {
                    if (attempt.ip) {
                        ipCounts[attempt.ip] = (ipCounts[attempt.ip] || 0) + 1;
                    }
                });

                // Create security alerts
                const alerts = [];
                
                // Add failed login alerts (last 10)
                const recentFailed = failedAttempts.slice(-10).reverse();
                recentFailed.forEach(attempt => {
                    alerts.push({
                        type: 'failed_login',
                        title: 'Failed Login Attempt',
                        details: `From IP: ${attempt.ip || 'Unknown IP'}`,
                        location: attempt.location ? 
                            `${attempt.location.city || 'Unknown City'}, ${attempt.location.country || 'Unknown Country'}` : 
                            'Unknown Location',
                        timestamp: attempt.timestamp || attempt.created_at || Date.now()
                    });
                });

                // Add suspicious IP alerts (multiple failed attempts)
                Object.entries(ipCounts).forEach(([ip, count]) => {
                    if (count >= 3) {
                        alerts.push({
                            type: 'suspicious_ip',
                            title: `Suspicious Activity`,
                            details: `${count} failed attempts from ${ip}`,
                            location: 'Multiple attempts detected',
                            timestamp: Date.now()
                        });
                    }
                });

                if (alerts.length > 0) {
                    // Show latest 5 alerts
                    const displayAlerts = alerts.slice(0, 5);
                    
                    container.innerHTML = displayAlerts.map(alert => `
                        <div class="activity-item">
                            <div class="activity-icon">
                                <i class="fas fa-${alert.type === 'suspicious_ip' ? 'shield-alt' : 'exclamation-triangle'}" 
                                   style="color: ${alert.type === 'suspicious_ip' ? '#ea4335' : '#f59e0b'};"></i>
                            </div>
                            <div class="activity-info">
                                <p class="activity-title">${alert.title}</p>
                                <p class="activity-time">${this.formatTime(alert.timestamp)}</p>
                                <p class="activity-details">${alert.details}</p>
                                ${alert.location !== 'Multiple attempts detected' ? 
                                    `<p class="activity-location" style="font-size: 11px; color: #8b8fa3; margin-top: 4px;">
                                        <i class="fas fa-map-marker-alt"></i> ${alert.location}
                                    </p>` : ''}
                            </div>
                        </div>
                    `).join('');
                    
                    console.log('✅ Security alerts loaded:', displayAlerts.length, 'alerts displayed');
                } else {
                    container.innerHTML = '<div class="no-data">No security alerts - All logins successful! 🎉</div>';
                    console.log('✅ No security alerts found - all logins were successful');
                }
            } else {
                container.innerHTML = `<div class="no-data">${response.error === 'rate_limit' ? 'Rate Limited' : 'Error loading alerts'}</div>`;
                console.warn('⚠️ Security alerts error:', response.message);
            }
        } catch (error) {
            console.error('❌ Security alerts loading failed:', error);
            container.innerHTML = '<div class="no-data">Error loading alerts</div>';
        }
    }

    async checkSystemStatus() {
        console.log('⚙️ Checking system status...');
        
        try {
            // Check API status
            const apiStatusElement = document.getElementById('apiStatus');
            if (apiStatusElement) {
                const response = await this.safeFetch(`${this.API_BASE}/health`, { 
                    headers: { 'Content-Type': 'application/json' }
                });
                
                if (response.success) {
                    apiStatusElement.className = 'status-indicator online';
                    console.log('✅ API status: Online');
                } else if (response.error === 'rate_limit') {
                    apiStatusElement.className = 'status-indicator warning';
                    console.log('⚠️ API status: Rate Limited');
                } else {
                    apiStatusElement.className = 'status-indicator offline';
                    console.log('❌ API status: Offline');
                }
            }

            // Database status (placeholder - assume online if API is working)
            const dbStatusElement = document.getElementById('dbStatus');
            if (dbStatusElement) {
                dbStatusElement.className = 'status-indicator online';
                console.log('✅ Database status: Online (assumed)');
            }
        } catch (error) {
            console.error('❌ System status check failed:', error);
            const apiStatusElement = document.getElementById('apiStatus');
            if (apiStatusElement) {
                apiStatusElement.className = 'status-indicator offline';
            }
        }
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString();
    }

    startAutoRefresh() {
        // Reduce refresh frequency to avoid rate limits
        this.refreshInterval = setInterval(() => {
            this.loadStatistics();
            this.loadRecentActivity();
            this.checkSystemStatus();
        }, 600000); // Refresh every 10 minutes instead of 5
    }

    showNotification(title, message, type = 'info') {
        // Use the unified notification system
        if (window.notificationManager) {
            // Combine title and message for unified system
            const fullMessage = title ? `${title}: ${message}` : message;
            return window.notificationManager.show(fullMessage, type);
        } else {
            // Fallback to global function
            const fullMessage = title ? `${title}: ${message}` : message;
            return showNotification(fullMessage, type);
        }
    }

    getNotificationIcon(type) {
        switch (type) {
            case 'success': return 'fa-check-circle';
            case 'error': return 'fa-exclamation-circle';
            case 'warning': return 'fa-exclamation-triangle';
            default: return 'fa-info-circle';
        }
    }
}

// ===== DASHBOARD NAVIGATION FUNCTIONS =====
async function navigateToPage(pageName) {
    const token = getAuthCookie();
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    // Show loading
    showPageNotification('Loading...', `Loading ${pageName} data`, 'info');

    try {
        // Use available endpoints based on page
        let endpoint;
        switch(pageName.toLowerCase()) {
            case 'analytics':
            case 'scouting':
                endpoint = '/api/teams';
                break;
            case 'whiteboards':
                endpoint = '/api/whiteboards';
                break;
            case 'ai':
                endpoint = '/api/ai/test';
                break;
            case 'betterstack':
                endpoint = '/api/status';
                break;
            case 'activity':
                endpoint = '/api/login-history';
                break;
            default:
                endpoint = '/health';
        }

        const response = await fetch(`https://api.teamsheldon.tech${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });

        if (response.ok) {
            const pageUrl = `${pageName.charAt(0).toUpperCase() + pageName.slice(1)}.html`;
            window.location.href = pageUrl;
        } else {
            showPageNotification('Error', 'Failed to load page data', 'error');
        }
    } catch (error) {
        console.error('Navigation error:', error);
        showPageNotification('Connection Error', 'Unable to connect to server', 'error');
    }
}

function getAuthCookie() {
    const name = 'admin_token=';
    const decodedCookie = decodeURIComponent(document.cookie);
    const cookieArray = decodedCookie.split(';');
    
    for (let i = 0; i < cookieArray.length; i++) {
        let cookie = cookieArray[i];
        while (cookie.charAt(0) === ' ') {
            cookie = cookie.substring(1);
        }
        if (cookie.indexOf(name) === 0) {
            return cookie.substring(name.length, cookie.length);
        }
    }
    return null;
}

function showPageNotification(title, message, type) {
    // Create notification if function exists
    if (window.adminPanel && window.adminPanel.showNotification) {
        window.adminPanel.showNotification(title, message, type);
    }
}

// ===== DASHBOARD BUTTON FUNCTIONS =====
function refreshDashboard() {
    if (window.dashboard) {
        window.dashboard.loadDashboardData();
        window.dashboard.showNotification('Refreshed', 'Dashboard data updated', 'success');
    }
}

function exportData() {
    window.dashboard.showNotification('Export', 'Data export functionality coming soon', 'info');
}

function viewAllActivity() {
    window.location.href = 'Activity.html';
}

function viewAllAlerts() {
    window.location.href = 'Security.html';
}

function performLogout() {
    console.log('🚪 Performing logout...');
    
    // Show notification
    if (window.notificationManager) {
        window.notificationManager.info('Logging out...', 2000);
    }
    
    // Clear all authentication data
    localStorage.removeItem('adminToken');
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');
    localStorage.removeItem('sessionId');
    
    // Clear any session storage
    sessionStorage.clear();
    
    console.log('🧹 Cleared authentication data from storage');
    
    // Optional: Notify server about logout (if API supports it)
    try {
        if (window.dashboard && window.dashboard.API_KEY) {
            fetch(`${window.dashboard.API_BASE}/api/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.dashboard.API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }).catch(() => {
                // Ignore server logout errors, continue with client logout
                console.log('📝 Server logout notification failed (continuing anyway)');
            });
        }
    } catch (error) {
        console.log('📝 Could not notify server of logout:', error.message);
    }
    
    // Redirect to login page after a brief delay
    setTimeout(() => {
        console.log('🔄 Redirecting to login page...');
        window.location.href = 'index.html';
    }, 500);
}

// ===== DASHBOARD INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    // Prevent "Leave site?" dialog on navigation
    window.addEventListener('beforeunload', function(e) {
        // Remove any returnValue to prevent the dialog
        delete e.returnValue;
    });
    
    window.dashboard = new Dashboard();
});
