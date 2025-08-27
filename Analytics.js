// Analytics.js - TeamSheldon Analytics Dashboard
class Analytics {
    constructor() {
        this.API_BASE = 'https://api.teamsheldon.tech';
        this.authToken = localStorage.getItem('authToken');
        this.charts = {};
        this.init();
    }

    async init() {
        console.log('📊 Initializing Analytics Dashboard...');
        
        // Check authentication
        if (!this.authToken) {
            console.warn('⚠️ No authentication token found');
            window.location.href = 'index.html';
            return;
        }

        // Verify token is valid
        try {
            await this.verifyAuth();
        } catch (error) {
            console.error('❌ Authentication failed:', error);
            localStorage.removeItem('authToken');
            window.location.href = 'index.html';
            return;
        }

        // Load user info
        this.loadUserInfo();

        // Initialize sidebar functionality
        this.initSidebar();

        // Load analytics data
        await this.loadAnalyticsData();
    }

    async verifyAuth() {
        console.log('🔑 Verifying authentication...');
        
        try {
            const response = await fetch(`${this.API_BASE}/api/teams`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Authentication failed: ${response.status}`);
            }

            console.log('✅ Authentication verified');
            return true;
        } catch (error) {
            console.error('❌ Auth verification failed:', error);
            throw error;
        }
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
            if (this.authToken) {
                try {
                    console.log('🔄 Attempting to fetch fresh user info from API...');
                    const response = await fetch(`${this.API_BASE}/api/user/profile`, {
                        headers: {
                            'Authorization': `Bearer ${this.authToken}`,
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
            
            // Update sidebar user info with safe element checking
            const sidebarUserName = document.getElementById('sidebarUserName');
            const sidebarUserRole = document.getElementById('sidebarUserRole');
            const sidebarUserEmail = document.getElementById('sidebarUserEmail');
            
            if (sidebarUserName) {
                sidebarUserName.textContent = username;
                console.log('✅ Updated sidebar username');
            } else {
                console.warn('⚠️ sidebarUserName element not found');
            }
            
            if (sidebarUserRole) {
                sidebarUserRole.textContent = userRole;
                console.log('✅ Updated sidebar user role');
            } else {
                console.warn('⚠️ sidebarUserRole element not found');
            }
            
            if (sidebarUserEmail) {
                sidebarUserEmail.textContent = userEmail;
                console.log('✅ Updated sidebar user email');
            } else {
                console.warn('⚠️ sidebarUserEmail element not found');
            }
            
        } catch (error) {
            console.error('❌ Error loading user info:', error);
            // Fallback to safe defaults
            const sidebarUserName = document.getElementById('sidebarUserName');
            const sidebarUserRole = document.getElementById('sidebarUserRole');
            const sidebarUserEmail = document.getElementById('sidebarUserEmail');
            
            if (sidebarUserName) sidebarUserName.textContent = 'Admin User';
            if (sidebarUserRole) sidebarUserRole.textContent = 'Administrator';
            if (sidebarUserEmail) sidebarUserEmail.textContent = 'admin@teamsheldon.tech';
        }
    }

    async safeFetch(url, options = {}) {
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.authToken}`,
                'Content-Type': 'application/json'
            },
            ...options
        };

        try {
            console.log(`🌐 Fetching: ${url}`);
            const response = await fetch(url, defaultOptions);
            
            if (!response.ok) {
                console.error(`❌ Fetch failed: ${response.status} ${response.statusText}`);
                return { ok: false, status: response.status };
            }

            const data = await response.json();
            console.log(`✅ Fetch successful:`, data);
            return { ok: true, data };
            
        } catch (error) {
            console.error(`❌ Fetch error for ${url}:`, error);
            return { ok: false, error: error.message };
        }
    }

    initSidebar() {
        const sidebar = document.getElementById('dashboardSidebar');
        const sidebarToggle = document.getElementById('sidebarToggle');
        const burgerMenuBtn = document.getElementById('burgerMenuBtn');
        const dashboardContainer = document.querySelector('.dashboard-container');

        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
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
                const icon = sidebarToggle.querySelector('i');
                if (icon) {
                    if (isHidden) {
                        icon.className = 'fas fa-bars';
                    } else {
                        icon.className = 'fas fa-times';
                    }
                }

                // Resize charts after transition completes
                setTimeout(() => {
                    window.dispatchEvent(new Event('resize'));
                    console.log('📊 Chart resize after sidebar toggle');
                }, 350);
            });
        }

        if (burgerMenuBtn) {
            burgerMenuBtn.addEventListener('click', () => {
                // Show sidebar again
                sidebar.classList.remove('hidden');
                if (dashboardContainer) {
                    dashboardContainer.classList.remove('sidebar-hidden');
                }
                burgerMenuBtn.style.display = 'none';
                
                // Update toggle button icon
                const icon = sidebarToggle?.querySelector('i');
                if (icon) {
                    icon.className = 'fas fa-times';
                }
                
                // Resize charts
                setTimeout(() => {
                    window.dispatchEvent(new Event('resize'));
                    console.log('📊 Chart resize after showing sidebar');
                }, 350);
            });
            
            // Initially hide burger menu since sidebar is visible by default
            burgerMenuBtn.style.display = 'none';
        }

        // Update status indicators
        this.updateStatusIndicators();
    }

    updateStatusIndicators() {
        // API Status
        const apiStatus = document.getElementById('apiStatus');
        if (apiStatus) {
            apiStatus.className = 'status-indicator online';
            apiStatus.title = 'API Online';
        }

        // Database Status
        const dbStatus = document.getElementById('dbStatus');
        if (dbStatus) {
            dbStatus.className = 'status-indicator online';
            dbStatus.title = 'Database Connected';
        }
    }

    async loadAnalyticsData() {
        console.log('📊 Loading analytics data...');
        
        try {
            // First try to use the new comprehensive admin system API
            try {
                console.log('🚀 Attempting to load system analytics from admin API...');
                const systemResponse = await this.safeFetch(`${this.API_BASE}/api/admin/system`);
                
                if (systemResponse.ok && systemResponse.data) {
                    console.log('✅ Successfully loaded system analytics data');
                    this.processSystemAnalytics(systemResponse.data);
                    return;
                } else {
                    console.log('⚠️ Admin system API not available, falling back to individual endpoints');
                }
            } catch (adminApiError) {
                console.log('⚠️ Admin system API error, falling back:', adminApiError.message);
            }

            // Fallback to original individual endpoints
            console.log('📡 Loading analytics from individual endpoints...');
            // Load all data in parallel - only use available API endpoints
            const [teamsResponse, whiteboardsResponse] = await Promise.all([
                this.safeFetch(`${this.API_BASE}/api/teams`),
                this.safeFetch(`${this.API_BASE}/api/whiteboards`)
            ]);

            // Create charts with the data
            await this.createPerformanceChart(teamsResponse);
            await this.createScoutingChart(teamsResponse, whiteboardsResponse); // Pass both teams and whiteboards
            await this.createTimelineChart(teamsResponse);
            await this.loadPopularStrategies(teamsResponse);

        } catch (error) {
            console.error('❌ Error loading analytics data:', error);
            this.showError('Failed to load analytics data');
        }
    }

    processSystemAnalytics(systemData) {
        console.log('🎯 Processing system analytics data:', systemData);
        
        // Log the structure to understand what we're working with
        if (systemData.analytics) {
            console.log('📊 Analytics data structure:', Object.keys(systemData.analytics));
        }
        if (systemData.statistics) {
            console.log('📈 Statistics data structure:', Object.keys(systemData.statistics));
        }
        
        // Update system performance metrics
        if (systemData.performance) {
            this.updatePerformanceMetrics(systemData.performance);
        }
        
        // Update resource usage
        if (systemData.resources) {
            this.updateResourceUsage(systemData.resources);
        }
        
        // Update health monitoring
        if (systemData.health) {
            this.updateHealthMonitoring(systemData.health);
        }
        
        // Update statistics overview
        if (systemData.statistics) {
            this.updateStatisticsOverview(systemData.statistics);
        }
        
        // Create enhanced analytics charts with system data
        this.createSystemAnalyticsCharts(systemData);
        
        console.log('✅ System analytics processing completed');
    }

    updatePerformanceMetrics(performance) {
        // Update response time elements if they exist
        this.setElementText('avgResponseTime', `${performance.averageResponseTime || 0}ms`);
        this.setElementText('apiResponseTime', `${performance.apiResponseTime || 0}ms`);
        
        // Update request metrics
        this.setElementText('requestsPerSecond', performance.requestsPerSecond || 0);
        this.setElementText('totalRequests', performance.totalRequests || 0);
        
        // Update error rates
        this.setElementText('errorRate', `${(performance.errorRate || 0).toFixed(2)}%`);
        this.setElementText('successRate', `${(100 - (performance.errorRate || 0)).toFixed(2)}%`);
    }

    updateResourceUsage(resources) {
        // Update memory usage elements if they exist
        const memoryUsage = resources.memoryUsage || {};
        this.setElementText('memoryUsed', `${(memoryUsage.used / 1024 / 1024).toFixed(2)} MB`);
        this.setElementText('memoryTotal', `${(memoryUsage.total / 1024 / 1024).toFixed(2)} MB`);
        this.setElementText('memoryPercent', `${((memoryUsage.used / memoryUsage.total) * 100).toFixed(1)}%`);
        
        // Update CPU usage
        this.setElementText('cpuUsage', `${(resources.cpuUsage || 0).toFixed(1)}%`);
    }

    updateHealthMonitoring(health) {
        // Update health status elements if they exist
        const healthElement = document.getElementById('systemHealthStatus');
        if (healthElement) {
            const status = health.overall || 'unknown';
            healthElement.textContent = status.toUpperCase();
            healthElement.className = `health-status ${status}`;
        }
        
        this.setElementText('apiHealth', health.apiHealth || 'Unknown');
        this.setElementText('databaseHealth', health.databaseHealth || 'Unknown');
        
        if (health.uptime) {
            this.setElementText('systemUptime', this.formatUptime(health.uptime));
        }
    }

    updateStatisticsOverview(statistics) {
        // Update user statistics elements if they exist
        if (statistics.users) {
            this.setElementText('totalUsers', statistics.users.total || 0);
            this.setElementText('activeUsers', statistics.users.active || 0);
        }
        
        // Update login statistics
        if (statistics.logins) {
            this.setElementText('totalLogins', statistics.logins.total || 0);
            this.setElementText('loginsToday', statistics.logins.today || 0);
        }
    }

    createSystemAnalyticsCharts(systemData) {
        console.log('📊 Creating enhanced analytics charts with system data...');
        console.log('📊 Available data keys:', Object.keys(systemData));
        
        // Create system performance charts alongside existing charts
        if (systemData.analytics) {
            console.log('📊 Analytics data available:', Object.keys(systemData.analytics));
            
            // Create performance trend chart if we have the data
            if (systemData.analytics.performanceTrends) {
                this.createSystemPerformanceChart(systemData.analytics.performanceTrends);
            }
            
            // Create login activity chart
            if (systemData.analytics.loginTrends) {
                this.createLoginActivityChart(systemData.analytics.loginTrends);
            }
        }
        
        // Try to get real teams and whiteboards data for charts
        let teamsData = [];
        let whiteboardsData = [];
        
        // Check different possible locations for team data
        if (systemData.analytics && systemData.analytics.teamData) {
            teamsData = systemData.analytics.teamData;
        } else if (systemData.teams) {
            teamsData = systemData.teams;
        } else if (systemData.statistics && systemData.statistics.teams) {
            teamsData = systemData.statistics.teams;
        }
        
        // Check different possible locations for whiteboard data
        if (systemData.analytics && systemData.analytics.whiteboardData) {
            whiteboardsData = systemData.analytics.whiteboardData;
        } else if (systemData.whiteboards) {
            whiteboardsData = systemData.whiteboards;
        }
        
        console.log(`📊 Found ${teamsData.length} teams and ${whiteboardsData.length} whiteboards in system data`);
        
        if (teamsData.length > 0 || whiteboardsData.length > 0) {
            // Use real data from system analytics
            console.log('✅ Using real data from system analytics');
            this.createPerformanceChart({ ok: true, data: teamsData });
            this.createScoutingChart({ ok: true, data: teamsData }, { ok: true, data: whiteboardsData });
            this.createTimelineChart({ ok: true, data: teamsData });
            this.loadPopularStrategies({ ok: true, data: teamsData });
        } else {
            // Fallback to individual API calls if system data doesn't have team data
            console.log('⚠️ System data lacks team/whiteboard data, trying individual endpoints...');
            this.loadIndividualAnalyticsData();
        }
    }

    async loadIndividualAnalyticsData() {
        console.log('📡 Loading analytics from individual API endpoints...');
        
        // Load data from individual endpoints
        const [teamsResponse, whiteboardsResponse] = await Promise.all([
            this.safeFetch(`${this.API_BASE}/api/teams`),
            this.safeFetch(`${this.API_BASE}/api/whiteboards`)
        ]);

        // Create charts with individual API data
        await this.createPerformanceChart(teamsResponse);
        await this.createScoutingChart(teamsResponse, whiteboardsResponse);
        await this.createTimelineChart(teamsResponse);
        await this.loadPopularStrategies(teamsResponse);
    }

    createSystemPerformanceChart(trends) {
        // Only create if we have a canvas for it
        const canvas = document.getElementById('systemPerformanceChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const last24Hours = trends.slice(-24);
        
        this.charts.systemPerformance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: last24Hours.map(t => new Date(t.timestamp).toLocaleTimeString()),
                datasets: [{
                    label: 'Response Time (ms)',
                    data: last24Hours.map(t => t.responseTime),
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#ffffff'
                        }
                    },
                    title: {
                        display: true,
                        text: 'System Performance (Real API Data)',
                        color: '#ffffff'
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#ffffff' },
                        grid: { color: 'rgba(255, 255, 255, 0.2)' }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#ffffff' },
                        grid: { color: 'rgba(255, 255, 255, 0.2)' },
                        title: {
                            display: true,
                            text: 'Response Time (ms)',
                            color: '#ffffff'
                        }
                    }
                }
            }
        });
    }

    createLoginActivityChart(loginTrends) {
        // Only create if we have a canvas for it
        const canvas = document.getElementById('loginActivityChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const last7Days = loginTrends.slice(-7);
        
        this.charts.loginActivity = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: last7Days.map(d => new Date(d.date).toLocaleDateString()),
                datasets: [{
                    label: 'Successful Logins',
                    data: last7Days.map(d => d.successful || 0),
                    backgroundColor: '#28a745'
                }, {
                    label: 'Failed Attempts',
                    data: last7Days.map(d => d.failed || 0),
                    backgroundColor: '#dc3545'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#ffffff'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Login Activity (Real API Data)',
                        color: '#ffffff'
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#ffffff' },
                        grid: { color: 'rgba(255, 255, 255, 0.2)' }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#ffffff' },
                        grid: { color: 'rgba(255, 255, 255, 0.2)' }
                    }
                }
            }
        });
    }

    formatUptime(uptimeSeconds) {
        const days = Math.floor(uptimeSeconds / (24 * 60 * 60));
        const hours = Math.floor((uptimeSeconds % (24 * 60 * 60)) / (60 * 60));
        const minutes = Math.floor((uptimeSeconds % (60 * 60)) / 60);
        
        return `${days}d ${hours}h ${minutes}m`;
    }

    setElementText(id, text) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = text;
        }
    }

    async createPerformanceChart(apiResponse) {
        console.log('📈 Creating performance chart...');
        
        // Check if Chart.js is available
        if (typeof Chart === 'undefined') {
            console.error('❌ Chart.js library not loaded');
            this.showChartError('performanceChart', 'Chart.js library not available');
            return;
        }
        
        const canvas = document.getElementById('performanceChart');
        const loadingDiv = document.getElementById('performanceLoading');
        
        if (!canvas) {
            console.warn('⚠️ Performance chart canvas not found');
            this.showChartError('performanceChart', 'Chart canvas element not found');
            return;
        }

        // Clear any existing chart
        if (this.charts.performance) {
            this.charts.performance.destroy();
        }

        try {
            let teams = [];
            if (apiResponse && apiResponse.ok && apiResponse.data) {
                teams = Array.isArray(apiResponse.data) ? apiResponse.data : apiResponse.data.teams || [];
            }

            console.log('📊 Processing performance data for', teams.length, 'teams');
            
            // Hide loading indicator
            if (loadingDiv) {
                loadingDiv.style.display = 'none';
            }

            // ONLY create chart if we have real data from API - NO SAMPLE DATA
            if (teams.length === 0) {
                console.warn('⚠️ No real team data available from API');
                this.showNoDataMessage('performanceChart', 'No performance data available from API');
                return;
            }
            
            const chartData = this.processRealRadarPerformanceData(teams);
            if (!chartData) {
                console.warn('⚠️ No processable performance data from API');
                this.showNoDataMessage('performanceChart', 'No processable performance metrics found');
                return;
            }

            const ctx = canvas.getContext('2d');
            
            this.charts.performance = new Chart(ctx, {
                type: 'radar',
                data: chartData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#ffffff',
                                font: { size: 12 }
                            }
                        },
                        title: {
                            display: true,
                            text: 'Team Performance Analysis (Real API Data)',
                            font: { size: 16, weight: 'bold' },
                            color: '#ffffff'
                        }
                    },
                    scales: {
                        r: {
                            beginAtZero: true,
                            max: 100,
                            grid: { color: 'rgba(255, 255, 255, 0.2)' },
                            pointLabels: { color: '#ffffff', font: { size: 11 } },
                            ticks: { 
                                display: false,
                                color: '#ffffff'
                            }
                        }
                    }
                }
            });
            
            console.log('✅ Performance chart created with real API data');

        } catch (error) {
            console.error('❌ Error creating performance chart:', error);
            this.showNoDataMessage('performanceChart', `Chart creation failed: ${error.message}`);
        }
    }

    showNoDataMessage(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            // Check if it's a canvas or regular element
            if (element.tagName && element.tagName.toLowerCase() === 'canvas' && element.parentElement) {
                const parent = element.parentElement;
                parent.innerHTML = `
                    <div class="no-data-message" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; background: #f8f9fa; border: 1px dashed #dee2e6; border-radius: 8px;">
                        <i class="fas fa-database" style="font-size: 48px; color: #6c757d; margin-bottom: 16px;"></i>
                        <h4 style="margin: 0 0 8px 0; color: #333;">No Real Data Available</h4>
                        <p style="margin: 0; color: #666; text-align: center;">${message}</p>
                        <button onclick="analytics.loadAnalyticsData()" style="margin-top: 16px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            <i class="fas fa-sync-alt"></i> Retry API Call
                        </button>
                    </div>
                `;
            } else {
                // Regular element (like strategiesList)
                element.innerHTML = `
                    <div class="no-data-message" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; background: #f8f9fa; border: 1px dashed #dee2e6; border-radius: 8px;">
                        <i class="fas fa-database" style="font-size: 48px; color: #6c757d; margin-bottom: 16px;"></i>
                        <h4 style="margin: 0 0 8px 0; color: #333;">No Real Data Available</h4>
                        <p style="margin: 0; color: #666; text-align: center;">${message}</p>
                        <button onclick="analytics.loadAnalyticsData()" style="margin-top: 16px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            <i class="fas fa-sync-alt"></i> Retry API Call
                        </button>
                    </div>
                `;
            }
        }
    }

    // REMOVED: Sample data functions - ONLY USE REAL API DATA

    showChartError(canvasId, message) {
        const canvas = document.getElementById(canvasId);
        if (canvas && canvas.parentElement) {
            const parent = canvas.parentElement;
            parent.innerHTML = `
                <div class="chart-error" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; background: #f8f9fa; border: 1px dashed #dee2e6; border-radius: 8px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #ffc107; margin-bottom: 16px;"></i>
                    <h4 style="margin: 0 0 8px 0; color: #333;">Chart Error</h4>
                    <p style="margin: 0; color: #666; text-align: center;">${message}</p>
                    <button onclick="analytics.loadAnalyticsData()" style="margin-top: 16px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        <i class="fas fa-sync-alt"></i> Retry
                    </button>
                </div>
            `;
        }
    }

    async createScoutingChart(teamsResponse, whiteboardsResponse) {
        console.log('🎯 Creating scouting activity chart...');
        
        // Check if Chart.js is available
        if (typeof Chart === 'undefined') {
            console.error('❌ Chart.js library not loaded for scouting chart');
            this.showChartError('scoutingChart', 'Chart.js library not available');
            return;
        }
        
        const canvas = document.getElementById('scoutingChart');
        const loadingDiv = document.getElementById('scoutingLoading');
        
        if (!canvas) {
            console.warn('⚠️ Scouting chart canvas not found');
            this.showChartError('scoutingChart', 'Chart canvas element not found');
            return;
        }

        // Clear any existing chart
        if (this.charts.scouting) {
            this.charts.scouting.destroy();
        }

        try {
            let teams = [];
            let whiteboards = [];
            
            if (teamsResponse && teamsResponse.ok && teamsResponse.data) {
                teams = Array.isArray(teamsResponse.data) ? teamsResponse.data : [];
            }
            
            if (whiteboardsResponse && whiteboardsResponse.ok && whiteboardsResponse.data) {
                whiteboards = Array.isArray(whiteboardsResponse.data) ? whiteboardsResponse.data : [];
            }

            console.log('📊 Processing scouting data for', teams.length, 'teams and', whiteboards.length, 'whiteboards');
            
            // Hide loading indicator
            if (loadingDiv) {
                loadingDiv.style.display = 'none';
            }

            // ONLY create chart if we have real data from API - NO SAMPLE DATA
            if (whiteboards.length === 0 && teams.length === 0) {
                console.warn('⚠️ No real scouting data available from API');
                this.showNoDataMessage('scoutingChart', 'No scouting data available from API');
                return;
            }

            const chartData = this.processRealScoutingData(whiteboards, teams);
            
            if (!chartData) {
                console.warn('⚠️ No scouting chart data available, showing no data message');
                this.showNoDataMessage('scoutingChart', 'No Scouting Data Available from API');
                return;
            }

            const ctx = canvas.getContext('2d');
            
            this.charts.scouting = new Chart(ctx, {
                type: 'doughnut',
                data: chartData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#ffffff',
                                font: {
                                    size: 12
                                }
                            }
                        },
                        title: {
                            display: true,
                            text: 'Scouting Activity Distribution (Real API Data)',
                            font: { size: 16, weight: 'bold' },
                            color: '#ffffff'
                        }
                    }
                }
            });
            
            console.log('✅ Scouting chart created with real API data');

        } catch (error) {
            console.error('❌ Error creating scouting chart:', error);
            this.showNoDataMessage('scoutingChart', `Chart creation failed: ${error.message}`);
        }
    }

    // REMOVED: Sample scouting data function - ONLY USE REAL API DATA

    async createTimelineChart(apiResponse) {
        console.log('📅 Creating timeline chart...');
        
        const canvas = document.getElementById('timelineChart');
        const loadingDiv = document.getElementById('timelineLoading');
        
        if (!canvas) {
            console.warn('Timeline chart canvas not found');
            return;
        }

        // Clear any existing chart
        if (this.charts.timeline) {
            this.charts.timeline.destroy();
        }

        try {
            let teams = [];
            if (apiResponse.ok && apiResponse.data) {
                teams = Array.isArray(apiResponse.data) ? apiResponse.data : apiResponse.data.teams || [];
            }

            console.log('📊 Processing timeline data for', teams.length, 'teams');
            
            // ONLY process real data - NO sample/fallback data
            if (teams.length === 0) {
                console.warn('⚠️ No teams data from API for timeline');
                this.showNoDataMessage('timelineChart', 'No timeline data available from API');
                return;
            }
            
            const chartData = this.processRealTimelineData(teams);
            
            if (!chartData) {
                console.warn('⚠️ No processable timeline data from API');
                this.showNoDataMessage('timelineChart', 'No submission timeline data available from API');
                return;
            }

            // Hide loading indicator
            if (loadingDiv) {
                loadingDiv.style.display = 'none';
            }

            const ctx = canvas.getContext('2d');
            
            this.charts.timeline = new Chart(ctx, {
                type: 'line',
                data: chartData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#ffffff',
                                font: { size: 12 }
                            }
                        },
                        title: {
                            display: true,
                            text: 'Submission Timeline (Real API Data)',
                            font: { size: 16, weight: 'bold' },
                            color: '#ffffff'
                        }
                    },
                    scales: {
                        x: {
                            ticks: { color: '#ffffff' },
                            grid: { color: 'rgba(255, 255, 255, 0.2)' }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: { 
                                color: '#ffffff',
                                stepSize: 1 
                            },
                            grid: { color: 'rgba(255, 255, 255, 0.2)' }
                        }
                    }
                }
            });

            console.log('✅ Timeline chart created with real API data');

        } catch (error) {
            console.error('❌ Error creating timeline chart:', error);
            this.showNoDataMessage('timelineChart', `Chart creation failed: ${error.message}`);
        }
    }

    async loadPopularStrategies(apiResponse) {
        console.log('🎯 Loading popular strategies...');
        
        const container = document.getElementById('strategiesContainer');
        const strategiesList = document.getElementById('strategiesList');
        const loadingDiv = document.querySelector('.strategies-loading');
        
        if (!container && !strategiesList) {
            console.warn('Strategies container not found');
            return;
        }

        const targetContainer = container || strategiesList;

        try {
            let teams = [];
            if (apiResponse.ok && apiResponse.data) {
                teams = Array.isArray(apiResponse.data) ? apiResponse.data : apiResponse.data.teams || [];
            }

            console.log('📊 Processing strategies for', teams.length, 'teams');
            
            // ONLY process real data - NO sample/fallback data
            if (teams.length === 0) {
                console.warn('⚠️ No teams data from API for strategies');
                this.showNoDataMessage('strategiesList', 'No strategy data available from API');
                return;
            }
            
            const strategies = this.processRealStrategiesData(teams);
            
            if (!strategies || strategies.length === 0) {
                console.warn('⚠️ No processable strategy data from API');
                this.showNoDataMessage('strategiesList', 'No team strategy information available from API');
                return;
            }

            // Hide loading indicator
            if (loadingDiv) {
                loadingDiv.style.display = 'none';
            }

            // Generate strategy list HTML
            const strategiesHTML = strategies.map(strategy => `
                <div class="strategy-item">
                    <div class="strategy-header">
                        <div class="strategy-rank">${strategy.rank}</div>
                        <div class="strategy-name">${strategy.name}</div>
                        <div class="strategy-stats">
                            <span class="strategy-teams">${strategy.teams} teams</span>
                            <span class="strategy-percentage">${strategy.percentage}%</span>
                        </div>
                    </div>
                    <div class="strategy-description">${strategy.description}</div>
                </div>
            `).join('');

            targetContainer.innerHTML = `<div class="strategy-list">${strategiesHTML}</div>`;

            console.log('✅ Strategies loaded with real API data');

        } catch (error) {
            console.error('❌ Error loading strategies:', error);
            // Hide loading indicator
            if (loadingDiv) loadingDiv.style.display = 'none';
            this.showNoDataMessage('strategiesList', `Failed to load strategy data: ${error.message}`);
        }
    }

    processRealRadarPerformanceData(teams) {
        if (!Array.isArray(teams) || teams.length === 0) {
            console.log('⚠️ No teams data provided');
            return null;
        }

        console.log('📊 Processing performance data for', teams.length, 'teams');

        // Reliability and consistency mapping from old system
        const reliabilityToNumber = {
            'Very High': 5,
            'High': 4,
            'Medium': 3,
            'Low': 2,
            'Very Low': 1
        };

        const consistencyToNumber = {
            'Very Consistent': 5,
            'Consistent': 4,
            'Somewhat Consistent': 3,
            'Inconsistent': 2,
            'Very Inconsistent': 1
        };

        // Extract real performance metrics using actual field names from API
        const performanceCategories = {
            autonomous: [],
            teleop: [],
            endgame: [],
            overall: [],
            consistency: []
        };

        teams.forEach(team => {
            // Look for actual performance metrics in team data (using old system field names)
            if (team.autonomousReliability && reliabilityToNumber[team.autonomousReliability]) {
                performanceCategories.autonomous.push(reliabilityToNumber[team.autonomousReliability]);
            }
            if (team.teleopReliability && reliabilityToNumber[team.teleopReliability]) {
                performanceCategories.teleop.push(reliabilityToNumber[team.teleopReliability]);
            }
            if (team.overallReliability && reliabilityToNumber[team.overallReliability]) {
                performanceCategories.endgame.push(reliabilityToNumber[team.overallReliability]);
                performanceCategories.overall.push(reliabilityToNumber[team.overallReliability]);
            }
            if (team.autonomousConsistency && consistencyToNumber[team.autonomousConsistency]) {
                performanceCategories.consistency.push(consistencyToNumber[team.autonomousConsistency]);
            }
        });

        console.log('📊 Performance categories extracted:', performanceCategories);

        // Calculate averages from real data
        const avgMetrics = {};
        Object.keys(performanceCategories).forEach(category => {
            const scores = performanceCategories[category];
            if (scores.length > 0) {
                avgMetrics[category] = scores.reduce((sum, score) => sum + score, 0) / scores.length;
            } else {
                avgMetrics[category] = 0; // Set to 0 instead of null to show in chart
            }
        });

        console.log('📊 Average metrics calculated:', avgMetrics);

        // Only create chart if we have at least some performance data
        const hasData = Object.values(avgMetrics).some(value => value > 0);
        if (!hasData) {
            console.log('⚠️ No performance metrics found in team data');
            return null;
        }

        return {
            labels: ['Autonomous', 'Teleop', 'Endgame', 'Overall', 'Consistency'],
            datasets: [{
                label: 'Team Performance',
                data: [
                    Math.round(avgMetrics.autonomous * 20) / 20, // Scale 1-5 to display nicely
                    Math.round(avgMetrics.teleop * 20) / 20,
                    Math.round(avgMetrics.endgame * 20) / 20,
                    Math.round(avgMetrics.overall * 20) / 20,
                    Math.round(avgMetrics.consistency * 20) / 20
                ],
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.2)',
                borderWidth: 2,
                pointBackgroundColor: '#3498db',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5
            }]
        };
    }

    processRealScoutingData(whiteboardsData, teamsData = []) {
        if (!Array.isArray(whiteboardsData) || whiteboardsData.length === 0) {
            console.log('⚠️ No whiteboard data available for scout activity analysis');
            return null;
        }

        console.log('📊 Analyzing scout activity from', whiteboardsData.length, 'whiteboards and', teamsData.length, 'teams');

        // Count scout activity by scoutName (like the old system)
        const scoutCounts = {};

        // Process whiteboard data
        whiteboardsData.forEach(whiteboard => {
            const scoutName = whiteboard.scoutName || whiteboard.createdBy || whiteboard.author || 'Unknown Scout';
            scoutCounts[scoutName] = (scoutCounts[scoutName] || 0) + 1;
        });

        // Also process teams data for additional scout information (like old system)
        if (Array.isArray(teamsData) && teamsData.length > 0) {
            teamsData.forEach(team => {
                const scoutName = team.scoutName || team.scout || team.scoutedBy || team.createdBy;
                if (scoutName && scoutName.trim() && scoutName !== 'Unknown Scout') {
                    scoutCounts[scoutName] = (scoutCounts[scoutName] || 0) + 1;
                }
            });
        }

        console.log('📊 Combined scout counts:', scoutCounts);

        // Get top 8 most active scouts
        const sortedScouts = Object.entries(scoutCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);

        if (sortedScouts.length === 0) {
            console.log('⚠️ No scout activity found in data');
            return null;
        }

        return {
            labels: sortedScouts.map(([name]) => name),
            datasets: [{
                label: 'Scout Activity',
                data: sortedScouts.map(([, count]) => count),
                backgroundColor: [
                    '#3498db',
                    '#2ecc71',
                    '#f39c12',
                    '#e74c3c',
                    '#9b59b6',
                    '#1abc9c',
                    '#34495e',
                    '#e67e22'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        };
    }

    processRealTimelineData(teams) {
        if (!Array.isArray(teams) || teams.length === 0) {
            return null;
        }

        // Get last 6 months of real submission data
        const last6Months = Array.from({ length: 6 }, (_, i) => {
            const date = new Date();
            date.setMonth(date.getMonth() - (5 - i));
            date.setDate(1);
            return date;
        });

        const labels = last6Months.map(date => 
            date.toLocaleDateString('en-US', { month: 'short' })
        );

        const submissionCounts = last6Months.map(date => {
            const nextMonth = new Date(date);
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            
            return teams.filter(team => {
                const teamDate = new Date(team.createdAt || team.submittedAt);
                return teamDate >= date && teamDate < nextMonth;
            }).length;
        });

        return {
            labels,
            datasets: [{
                label: 'Team Submissions',
                data: submissionCounts,
                borderColor: '#2ecc71',
                backgroundColor: 'rgba(46, 204, 113, 0.2)',
                fill: true,
                tension: 0.4
            }]
        };
    }

    processRealStrategiesData(teams) {
        if (!Array.isArray(teams) || teams.length === 0) {
            return [];
        }

        console.log('📊 Processing strategies for', teams.length, 'teams');

        const strategyMap = {};
        const totalTeams = teams.length;

        // Extract strategies from real team data using actual field names
        teams.forEach(team => {
            let strategies = [];

            // Check startingPositions array (from old system)
            if (team.startingPositions && Array.isArray(team.startingPositions)) {
                team.startingPositions.forEach(pos => {
                    strategies.push({
                        name: `${pos} Starting Position`,
                        description: `Teams starting from ${pos.toLowerCase()} position`
                    });
                });
            }

            // Check allianceRoles array (from old system)
            if (team.allianceRoles && Array.isArray(team.allianceRoles)) {
                team.allianceRoles.forEach(role => {
                    strategies.push({
                        name: `${role} Role`,
                        description: `Teams specializing in ${role.toLowerCase()} role`
                    });
                });
            }

            // Check autonomous tasks
            if (team.autonomousTasks) {
                const tasks = team.autonomousTasks.toLowerCase();
                if (tasks.includes('score') || tasks.includes('scoring')) {
                    strategies.push({
                        name: 'Autonomous Scoring',
                        description: 'Teams focused on autonomous scoring'
                    });
                }
                if (tasks.includes('mobility') || tasks.includes('move')) {
                    strategies.push({
                        name: 'Mobility Strategy',
                        description: 'Teams prioritizing mobility in autonomous'
                    });
                }
                if (tasks.includes('balance') || tasks.includes('dock')) {
                    strategies.push({
                        name: 'Balancing/Docking',
                        description: 'Teams specializing in balancing or docking'
                    });
                }
            }

            // Check reliability categories as strategies
            if (team.overallReliability) {
                strategies.push({
                    name: `${team.overallReliability} Reliability`,
                    description: `Teams with ${team.overallReliability.toLowerCase()} overall reliability`
                });
            }

            // Add each strategy to the map
            strategies.forEach(strategy => {
                if (!strategyMap[strategy.name]) {
                    strategyMap[strategy.name] = {
                        name: strategy.name,
                        description: strategy.description,
                        count: 0
                    };
                }
                strategyMap[strategy.name].count++;
            });
        });

        console.log('📊 Strategy map:', strategyMap);

        // Convert to array and calculate percentages
        const strategies = Object.values(strategyMap).map(strategy => ({
            name: strategy.name,
            description: strategy.description,
            teams: strategy.count,
            percentage: Math.round((strategy.count / totalTeams) * 100)
        }));

        // Sort by team count and add rankings
        return strategies
            .sort((a, b) => b.teams - a.teams)
            .slice(0, 6)
            .map((strategy, index) => ({
                ...strategy,
                rank: index + 1
            }));
    }

    showError(message) {
        console.error('❌', message);
        // TODO: Implement error display
    }
}

function refreshAnalytics() {
    if (window.analytics) {
        window.analytics.loadAnalyticsData();
    }
}

function exportAnalytics() {
    console.log('📊 Export functionality to be implemented');
    // TODO: Implement analytics export functionality
}

function performLogout() {
    console.log('🚪 Performing logout...');
    
    // Clear all authentication data
    localStorage.removeItem('adminToken');
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');
    localStorage.removeItem('sessionId');
    
    // Clear any session storage
    sessionStorage.clear();
    
    console.log('🧹 Cleared authentication data from storage');
    
    // Redirect to login page after a brief delay
    setTimeout(() => {
        console.log('🔄 Redirecting to login page...');
        window.location.href = 'index.html';
    }, 500);
}

// ===== ANALYTICS INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    window.analytics = new Analytics();
});
