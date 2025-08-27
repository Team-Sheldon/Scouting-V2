/**
 * Activity Logs Management System
 * Handles login logs display, filtering, and analysis
 */

class ActivityLogsManager {
    constructor() {
        this.API_BASE = 'https://api.teamsheldon.tech';
        this.currentPage = 1;
        this.logsPerPage = 50;
        this.totalLogs = 0;
        this.filteredLogs = [];
        this.allLogs = [];
        this.currentSort = { field: 'timestamp', direction: 'desc' };
        this.selectedLog = null;
        
        this.init();
    }

    async init() {
        console.log('🚀 Initializing Activity Logs Manager...');
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load user info and initialize UI
        await this.loadUserInfo();
        
        // Initialize date inputs with default values
        this.initializeDateRange();
        
        // Load initial data
        await this.loadActivityLogs();
        
        // Set up auto-refresh
        this.setupAutoRefresh();
        
        console.log('✅ Activity Logs Manager initialized successfully');
    }

    async loadUserInfo() {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                console.warn('⚠️ No auth token found');
                // For testing purposes, don't redirect immediately
                // Just use default values and continue
                this.updateUserDisplay({
                    username: 'Admin User (No Token)',
                    role: 'Administrator',
                    email: 'admin@teamsheldon.tech'
                });
                return;
            }

            // Try to get user info from localStorage first
            const storedUserInfo = localStorage.getItem('userInfo');
            if (storedUserInfo) {
                const userInfo = JSON.parse(storedUserInfo);
                this.updateUserDisplay(userInfo);
                return;
            }

            // If not in localStorage, fetch from API
            const response = await fetch(`${this.API_BASE}/api/user/profile`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const userInfo = await response.json();
                this.updateUserDisplay(userInfo);
                localStorage.setItem('userInfo', JSON.stringify(userInfo));
            } else if (response.status === 401) {
                console.warn('⚠️ Token expired, redirecting to login');
                localStorage.clear();
                window.location.href = 'index.html';
            }
        } catch (error) {
            console.error('❌ Error loading user info:', error);
            // Don't redirect on error, just use default values
            this.updateUserDisplay({
                username: 'Admin User',
                role: 'Administrator',
                email: 'admin@teamsheldon.tech'
            });
        }
    }

    updateUserDisplay(userInfo) {
        const username = userInfo.username || userInfo.name || 'Admin User';
        const userRole = userInfo.role || userInfo.userRole || 'Administrator';
        const userEmail = userInfo.email || userInfo.userEmail || 'admin@teamsheldon.tech';
        
        // Update sidebar user info
        this.setElementText('sidebarUserName', username);
        this.setElementText('sidebarUserRole', userRole);
        this.setElementText('sidebarUserEmail', userEmail);
    }

    setElementText(id, text) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = text;
        }
    }

    setupEventListeners() {
        // Search filters
        document.getElementById('dateFilter')?.addEventListener('change', () => this.applyFilters());
        document.getElementById('ipAddress')?.addEventListener('input', () => this.debounceFilter());
        document.getElementById('status')?.addEventListener('change', () => this.applyFilters());
        
        // Table row clicks
        document.getElementById('logsTableBody')?.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            if (row && row.dataset.logId) {
                this.showLogDetails(row.dataset.logId);
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('logDetailsModal').classList.contains('show')) {
                this.closeLogModal();
            }
        });

        // Sidebar navigation
        this.setupNavigationHandlers();
    }

    setupNavigationHandlers() {
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

        // Status indicators
        this.updateStatusIndicators();
    }

    toggleSidebar() {
        const sidebar = document.getElementById('dashboardSidebar');
        const sidebarToggle = document.getElementById('sidebarToggle');
        const burgerMenuBtn = document.getElementById('burgerMenuBtn');

        if (sidebar) {
            // Toggle sidebar visibility
            sidebar.classList.toggle('hidden');
            
            // Update burger menu visibility
            if (burgerMenuBtn) {
                if (sidebar.classList.contains('hidden')) {
                    burgerMenuBtn.style.display = 'flex';
                } else {
                    burgerMenuBtn.style.display = 'none';
                }
            }
        }
    }

    updateStatusIndicators() {
        // API Status
        this.checkAPIStatus();
        
        // Set up periodic status checks
        setInterval(() => {
            this.checkAPIStatus();
        }, 30000); // Check every 30 seconds
    }

    async checkAPIStatus() {
        const apiIndicator = document.getElementById('apiStatus');
        const dbIndicator = document.getElementById('dbStatus');
        
        try {
            const response = await fetch(`${this.API_BASE}/health`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                if (apiIndicator) {
                    apiIndicator.className = 'status-indicator online';
                }
                if (dbIndicator) {
                    dbIndicator.className = 'status-indicator online';
                }
            } else {
                throw new Error('API not responding');
            }
        } catch (error) {
            // If health endpoint fails, try a basic API call
            try {
                const testResponse = await fetch(`${this.API_BASE}/api/login-history`, {
                    method: 'HEAD', // Just check if endpoint exists
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (testResponse.status !== 404) {
                    // API is responding, even if it's an auth error
                    if (apiIndicator) {
                        apiIndicator.className = 'status-indicator online';
                    }
                    if (dbIndicator) {
                        dbIndicator.className = 'status-indicator online';
                    }
                } else {
                    throw new Error('API not available');
                }
            } catch (secondError) {
                if (apiIndicator) {
                    apiIndicator.className = 'status-indicator offline';
                }
                if (dbIndicator) {
                    dbIndicator.className = 'status-indicator offline';
                }
            }
        }
    }

    initializeDateRange() {
        const today = new Date();
        document.getElementById('dateFilter').value = today.toISOString().split('T')[0];
    }

    setupAutoRefresh() {
        // Refresh every 30 seconds for real-time updates
        setInterval(() => {
            this.loadActivityLogs(false); // Silent refresh
        }, 30000);
    }

    async loadActivityLogs(showLoading = true) {
        console.log('📊 Loading activity logs from API...');
        console.log('🔑 Auth token present:', !!localStorage.getItem('authToken'));
        console.log('🔑 Token preview:', localStorage.getItem('authToken')?.substring(0, 20) + '...');
        
        if (showLoading) {
            this.showLoadingState();
        }

        try {
            const token = localStorage.getItem('authToken');
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // Only add auth header if token exists
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            // First try to use the new comprehensive admin dashboard API for enhanced analytics
            try {
                console.log('� Attempting to load comprehensive activity data from admin API...');
                const dashboardResponse = await fetch(`${this.API_BASE}/api/admin/dashboard`, {
                    method: 'GET',
                    headers: headers
                });

                if (dashboardResponse.ok) {
                    const dashboardData = await dashboardResponse.json();
                    if (dashboardData && dashboardData.statistics && dashboardData.analytics) {
                        console.log('✅ Successfully loaded comprehensive activity data from admin API');
                        this.processDashboardActivityData(dashboardData);
                        return;
                    }
                }
                console.log('⚠️ Admin dashboard API available but no comprehensive data, falling back');
            } catch (adminApiError) {
                console.log('⚠️ Admin dashboard API not available, falling back:', adminApiError.message);
            }

            // Fallback to original login history endpoint
            console.log('�📡 Making request to:', `${this.API_BASE}/api/login-history`);
            console.log('📡 Headers:', headers);
            
            const response = await fetch(`${this.API_BASE}/api/login-history`, {
                method: 'GET',
                headers: headers
            });

            console.log('📡 API Response status:', response.status);
            console.log('📡 API Response headers:', response.headers);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('📊 Received data:', data);
            console.log('📊 Data structure check:', {
                isArray: Array.isArray(data),
                hasHistory: data.history !== undefined,
                historyLength: data.history ? data.history.length : 'N/A',
                dataKeys: Object.keys(data)
            });
            
            // Handle different API response structures (matching old system)
            if (data.success === false) {
                throw new Error(data.message || 'Failed to load activity logs');
            }
            
            // Extract logs array from API response (same logic as old system)
            let logsArray = [];
            if (data && data.history) {
                logsArray = data.history;
                console.log('📊 Using data.history array with', logsArray.length, 'entries');
            } else if (data && Array.isArray(data)) {
                logsArray = data;
                console.log('📊 Using direct array with', logsArray.length, 'entries');
            } else {
                console.warn('⚠️ Unexpected response format:', data);
                logsArray = [];
            }
            
            // Transform the data to match our expected format while preserving all API data
            this.allLogs = logsArray.map((entry, index) => ({
                id: entry._id || entry.id || `log_${index}`,
                timestamp: entry.timestamp,
                ipAddress: entry.ip || entry.ipAddress,
                username: entry.username || 'Unknown',
                // Convert old system's boolean success to status string
                status: this.convertSuccessToStatus(entry.success),
                userAgent: entry.user_agent || entry.userAgent || 'Unknown',
                location: entry.location || entry.country || '',
                sessionDuration: entry.session_duration || entry.sessionDuration || 0,
                failureReason: entry.failure_reason || entry.failureReason || (!entry.success ? 'Login failed' : null),
                riskScore: entry.risk_score || entry.riskScore || 0,
                deviceFingerprint: entry.device_fingerprint || entry.deviceFingerprint || 'Unknown',
                // Preserve all API data for detailed popup
                rawData: entry,
                // Extract browser info
                browserInfo: entry.browser_info || {
                    browser: 'Unknown',
                    version: 'Unknown',
                    os: 'Unknown',
                    platform: 'Unknown'
                },
                // Extract location details
                locationData: entry.location || {
                    city: 'Unknown',
                    country: 'Unknown',
                    country_code: 'UN',
                    region: 'Unknown',
                    isp: 'Unknown'
                },
                // Additional metadata
                failedAttempts: entry.failed_attempts || 0,
                createdAt: entry.createdAt,
                updatedAt: entry.updatedAt
            }));
            
            console.log(`✅ Processed ${this.allLogs.length} activity logs from API`);
            console.log('📊 Sample log entry:', this.allLogs[0]);
            
            this.updateStatistics();
            this.applyFilters();

        } catch (error) {
            console.error('❌ Error loading activity logs:', error);
            console.log('🔍 Error details:', {
                message: error.message,
                stack: error.stack,
                apiBase: this.API_BASE
            });
            
            // Show error state - no mock data
            this.showErrorState(error.message);
            this.allLogs = [];
            this.updateStatistics();
            this.applyFilters();
        } finally {
            if (showLoading) {
                this.hideLoadingState();
            }
        }
    }

    processDashboardActivityData(dashboardData) {
        console.log('🎯 Processing comprehensive dashboard activity data:', dashboardData);
        
        const statistics = dashboardData.statistics;
        const analytics = dashboardData.analytics;
        const monitoring = dashboardData.monitoring;
        
        // Update activity overview statistics with comprehensive data
        this.updateActivityOverview(statistics);
        
        // Process login trends for enhanced charts
        if (analytics && analytics.loginTrends) {
            this.createActivityCharts(analytics.loginTrends);
        }
        
        // Update security monitoring in activity context
        if (monitoring && monitoring.security) {
            this.updateSecurityOverview(monitoring.security);
        }
        
        // Get detailed login history - prefer recentActivity or loginHistory from analytics
        const loginHistory = dashboardData.recentActivity || analytics.recentActivity || [];
        
        // Transform comprehensive data to match activity log format
        this.allLogs = loginHistory.map((entry, index) => ({
            id: entry._id || entry.id || `admin_log_${index}`,
            timestamp: entry.timestamp || entry.date,
            ipAddress: entry.ip || entry.ipAddress || 'Unknown',
            username: entry.username || entry.user || 'Unknown',
            status: entry.status || (entry.success ? 'success' : 'failed'),
            userAgent: entry.userAgent || 'Unknown',
            location: entry.location || entry.country || '',
            sessionDuration: entry.sessionDuration || 0,
            failureReason: entry.failureReason || (!entry.success ? 'Login failed' : null),
            riskScore: entry.riskScore || 0,
            deviceFingerprint: entry.deviceFingerprint || 'Unknown',
            rawData: entry,
            browserInfo: entry.browserInfo || {
                browser: 'Unknown',
                version: 'Unknown',
                os: 'Unknown',
                platform: 'Unknown'
            },
            locationData: entry.locationData || {
                city: entry.city || 'Unknown',
                country: entry.country || 'Unknown',
                country_code: entry.countryCode || 'UN',
                region: entry.region || 'Unknown',
                isp: entry.isp || 'Unknown'
            },
            failedAttempts: entry.failedAttempts || 0,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt
        }));
        
        console.log(`✅ Processed ${this.allLogs.length} comprehensive activity logs`);
        
        this.updateStatistics();
        this.applyFilters();
        
        console.log('✅ Comprehensive dashboard activity data processed');
    }

    processSecurityActivityData(securityData) {
        console.log('🛡️ Processing security activity data:', securityData);
        
        const statistics = securityData.statistics;
        
        // Update activity statistics with security-specific failed attempts data
        if (statistics.failedLogins) {
            console.log('📊 Updating failed attempts with security data:', statistics.failedLogins);
            
            // Update failed attempts from security statistics and mark as from security API
            const failedAttemptsElement = document.getElementById('failedAttempts');
            const failuresTodayElement = document.getElementById('failuresToday');
            
            if (failedAttemptsElement) {
                failedAttemptsElement.textContent = statistics.failedLogins.total.toLocaleString();
                failedAttemptsElement.dataset.fromSecurityApi = 'true';
            }
            if (failuresTodayElement) {
                failuresTodayElement.textContent = `${statistics.failedLogins.today} today`;
                failuresTodayElement.dataset.fromSecurityApi = 'true';
            }
        }
        
        // Update security threat information
        if (statistics.threats) {
            this.setElementText('securityThreats', statistics.threats.active || 0);
            this.setElementText('threatLevel', statistics.threats.level || 'Low');
        }
        
        // Update login attempts data
        if (statistics.loginAttempts) {
            this.setElementText('totalLoginAttempts', statistics.loginAttempts.total || 0);
            this.setElementText('suspiciousAttempts', statistics.loginAttempts.suspicious || 0);
        }
        
        // Get detailed failed login history from security data
        if (securityData.recentFailedLogins) {
            console.log('📊 Processing failed login details from security API');
            const failedLogins = securityData.recentFailedLogins.map((entry, index) => ({
                id: entry._id || entry.id || `security_log_${index}`,
                timestamp: entry.timestamp || entry.date,
                ipAddress: entry.ip || entry.ipAddress || 'Unknown',
                username: entry.username || entry.user || 'Unknown',
                status: 'failed', // All entries from security endpoint are failed
                userAgent: entry.userAgent || 'Unknown',
                location: entry.location || entry.country || '',
                sessionDuration: 0,
                failureReason: entry.reason || entry.failureReason || 'Authentication failed',
                riskScore: entry.riskScore || entry.threatScore || 0,
                deviceFingerprint: entry.deviceFingerprint || 'Unknown',
                rawData: entry,
                browserInfo: entry.browserInfo || {
                    browser: 'Unknown',
                    version: 'Unknown',
                    os: 'Unknown',
                    platform: 'Unknown'
                },
                locationData: entry.locationData || {
                    city: entry.city || 'Unknown',
                    country: entry.country || 'Unknown',
                    country_code: entry.countryCode || 'UN',
                    region: entry.region || 'Unknown',
                    isp: entry.isp || 'Unknown'
                },
                failedAttempts: entry.attemptCount || 1,
                createdAt: entry.createdAt,
                updatedAt: entry.updatedAt
            }));
            
            // Add failed logins to the main logs array
            this.allLogs = [...this.allLogs, ...failedLogins];
            console.log(`✅ Added ${failedLogins.length} failed login records from security API`);
        }
        
        console.log('✅ Security activity data processed');
    }

    updateActivityOverview(statistics) {
        console.log('📊 Updating activity overview with statistics:', statistics);
        
        // Update login statistics in the header/overview area
        if (statistics.logins) {
            this.setElementText('totalLogins', statistics.logins.total);
            this.setElementText('loginsToday', statistics.logins.today);
            this.setElementText('failedLogins', statistics.logins.totalFailed);
            this.setElementText('failedLoginsToday', statistics.logins.failedToday);
        }
        
        // Update user statistics
        if (statistics.users) {
            this.setElementText('totalUsers', statistics.users.total);
            this.setElementText('activeUsers', statistics.users.active);
            this.setElementText('newUsersToday', statistics.users.newToday);
        }
        
        // Calculate and display success rate
        if (statistics.logins) {
            const totalAttempts = statistics.logins.total + statistics.logins.totalFailed;
            const successRate = totalAttempts > 0 ? ((statistics.logins.total / totalAttempts) * 100).toFixed(1) : 100;
            this.setElementText('loginSuccessRate', `${successRate}%`);
        }
        
        console.log('✅ Activity overview updated');
    }

    updateSecurityOverview(securityData) {
        console.log('🛡️ Updating security overview in activity context:', securityData);
        
        // Update security-related activity metrics
        this.setElementText('securityThreats', securityData.activeThreats || 0);
        this.setElementText('securityLevel', securityData.level || 'Low');
        
        // Update threat level indicator
        const threatElement = document.getElementById('threatLevel');
        if (threatElement) {
            threatElement.className = `threat-level ${securityData.level || 'low'}`;
            threatElement.textContent = (securityData.level || 'Low').toUpperCase();
        }
        
        console.log('✅ Security overview updated in activity context');
    }

    createActivityCharts(loginTrends) {
        console.log('📊 Creating enhanced activity charts with login trends:', loginTrends);
        
        // Create login activity trend chart
        this.createLoginTrendChart(loginTrends);
        
        // Create daily activity distribution
        this.createDailyActivityChart(loginTrends);
        
        // Create login success/failure ratio chart
        this.createSuccessRatioChart(loginTrends);
        
        console.log('✅ Enhanced activity charts created');
    }

    createLoginTrendChart(trends) {
        const canvas = document.getElementById('loginTrendChart');
        if (!canvas) {
            console.log('ℹ️ Login trend chart canvas not found, skipping');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        const last30Days = trends.slice(-30);
        
        if (this.charts && this.charts.loginTrend) {
            this.charts.loginTrend.destroy();
        }
        
        if (!this.charts) this.charts = {};
        
        this.charts.loginTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: last30Days.map(d => new Date(d.date).toLocaleDateString()),
                datasets: [{
                    label: 'Successful Logins',
                    data: last30Days.map(d => d.successful || d.count || 0),
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    fill: true
                }, {
                    label: 'Failed Attempts',
                    data: last30Days.map(d => d.failed || 0),
                    borderColor: '#dc3545',
                    backgroundColor: 'rgba(220, 53, 69, 0.1)',
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Attempts'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Login Activity Trend (Last 30 Days)'
                    },
                    legend: {
                        position: 'top'
                    }
                }
            }
        });
    }

    createDailyActivityChart(trends) {
        const canvas = document.getElementById('dailyActivityChart');
        if (!canvas) {
            console.log('ℹ️ Daily activity chart canvas not found, skipping');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        const last7Days = trends.slice(-7);
        
        if (this.charts && this.charts.dailyActivity) {
            this.charts.dailyActivity.destroy();
        }
        
        if (!this.charts) this.charts = {};
        
        this.charts.dailyActivity = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: last7Days.map(d => new Date(d.date).toLocaleDateString()),
                datasets: [{
                    label: 'Login Activity',
                    data: last7Days.map(d => (d.successful || d.count || 0) + (d.failed || 0)),
                    backgroundColor: '#007bff',
                    borderColor: '#0056b3',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Total Activity'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Daily Login Activity (Last 7 Days)'
                    }
                }
            }
        });
    }

    createSuccessRatioChart(trends) {
        const canvas = document.getElementById('successRatioChart');
        if (!canvas) {
            console.log('ℹ️ Success ratio chart canvas not found, skipping');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Calculate total successful vs failed
        const totalSuccessful = trends.reduce((sum, d) => sum + (d.successful || d.count || 0), 0);
        const totalFailed = trends.reduce((sum, d) => sum + (d.failed || 0), 0);
        
        if (this.charts && this.charts.successRatio) {
            this.charts.successRatio.destroy();
        }
        
        if (!this.charts) this.charts = {};
        
        this.charts.successRatio = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Successful Logins', 'Failed Attempts'],
                datasets: [{
                    data: [totalSuccessful, totalFailed],
                    backgroundColor: ['#28a745', '#dc3545'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Login Success Rate'
                    },
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    convertSuccessToStatus(success) {
        if (success === true) {
            return 'success';
        } else if (success === false) {
            return 'failed';
        } else {
            return 'unknown';
        }
    }

    showErrorState(message) {
        const tbody = document.getElementById('logsTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr class="error-row">
                    <td colspan="4">
                        <div class="error-message">
                            <i class="fas fa-exclamation-triangle"></i>
                            <h3>Failed to Load Activity Logs</h3>
                            <p>${message}</p>
                            <button onclick="activityManager.loadActivityLogs()" class="retry-btn">
                                <i class="fas fa-redo"></i> Retry
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }
        
        // Update counts to show error state
        document.getElementById('logsCount').textContent = 'Failed to load logs';
    }

    hideLoadingState() {
        // Hide any loading overlays
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    showLoadingState() {
        const tbody = document.getElementById('logsTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr class="loading-row">
                    <td colspan="4">
                        <div class="logs-loading">
                            <i class="fas fa-spinner fa-spin"></i>
                            <span>Loading activity logs from API...</span>
                        </div>
                    </td>
                </tr>
            `;
        }
        
        document.getElementById('logsCount').textContent = 'Loading...';
    }

    updateStatistics() {
        console.log('📊 Updating statistics with', this.allLogs.length, 'total logs');
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayLogs = this.allLogs.filter(log => {
            const logDate = new Date(log.timestamp);
            logDate.setHours(0, 0, 0, 0);
            return logDate.getTime() === today.getTime();
        });

        console.log('📊 Today logs:', todayLogs.length);
        console.log('📊 Sample logs status:', this.allLogs.slice(0, 5).map(log => ({ status: log.status, timestamp: log.timestamp })));

        // Total entries
        document.getElementById('totalEntries').textContent = this.allLogs.length.toLocaleString();
        document.getElementById('entriesToday').textContent = `${todayLogs.length} today`;

        // Successful logins
        const successful = this.allLogs.filter(log => log.status === 'success');
        const successToday = todayLogs.filter(log => log.status === 'success');
        document.getElementById('successfulLogins').textContent = successful.length.toLocaleString();
        document.getElementById('successesToday').textContent = `${successToday.length} today`;

        console.log('📊 Successful logins:', successful.length, 'today:', successToday.length);

        // Unique IPs
        const allIPs = new Set(this.allLogs.map(log => log.ipAddress));
        const todayIPs = new Set(todayLogs.map(log => log.ipAddress));
        const existingIPs = new Set(this.allLogs.filter(log => {
            const logDate = new Date(log.timestamp);
            return logDate < today;
        }).map(log => log.ipAddress));
        const newIPsToday = [...todayIPs].filter(ip => !existingIPs.has(ip));
        
        document.getElementById('uniqueIPs').textContent = allIPs.size.toLocaleString();
        document.getElementById('newIPsToday').textContent = `${newIPsToday.length} new today`;

        // Failed attempts - include any non-success status
        const failed = this.allLogs.filter(log => log.status !== 'success');
        const failedToday = todayLogs.filter(log => log.status !== 'success');
        
        console.log('📊 Failed attempts calculation:', {
            totalFailed: failed.length,
            failedToday: failedToday.length,
            failedStatuses: [...new Set(failed.map(log => log.status))]
        });
        
        // Only update if we don't have data from security API (which has more accurate counts)
        const failedAttemptsElement = document.getElementById('failedAttempts');
        const failuresTodayElement = document.getElementById('failuresToday');
        
        if (failedAttemptsElement && !failedAttemptsElement.dataset.fromSecurityApi) {
            failedAttemptsElement.textContent = failed.length.toLocaleString();
        }
        if (failuresTodayElement && !failuresTodayElement.dataset.fromSecurityApi) {
            failuresTodayElement.textContent = `${failedToday.length} today`;
        }
        
        console.log('📊 Statistics updated - Total:', this.allLogs.length, 'Success:', successful.length, 'Failed:', failed.length);
    }

    applyFilters() {
        console.log('🔍 Applying filters to activity logs...');
        
        let filtered = [...this.allLogs];
        
        // Single date filter
        const dateFilter = document.getElementById('dateFilter')?.value;
        
        if (dateFilter) {
            const filterDate = new Date(dateFilter);
            filterDate.setHours(0, 0, 0, 0);
            const nextDay = new Date(filterDate.getTime() + 24 * 60 * 60 * 1000);
            
            filtered = filtered.filter(log => {
                const logDate = new Date(log.timestamp);
                return logDate >= filterDate && logDate < nextDay;
            });
        }
        
        // IP address filter
        const ipFilter = document.getElementById('ipAddress')?.value.trim();
        if (ipFilter) {
            filtered = filtered.filter(log => 
                log.ipAddress.toLowerCase().includes(ipFilter.toLowerCase())
            );
        }
        
        // Status filter
        const statusFilter = document.getElementById('status')?.value;
        if (statusFilter) {
            filtered = filtered.filter(log => log.status === statusFilter);
        }
        
        this.filteredLogs = filtered;
        this.totalLogs = filtered.length;
        this.currentPage = 1;
        
        this.sortLogs(this.currentSort.field, this.currentSort.direction, false);
        this.displayLogs();
        this.updatePagination();
    }

    debounceFilter() {
        clearTimeout(this.filterTimeout);
        this.filterTimeout = setTimeout(() => this.applyFilters(), 300);
    }

    sortLogs(field, direction = null, updateDisplay = true) {
        if (direction === null) {
            // Toggle direction if same field
            if (this.currentSort.field === field) {
                direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                direction = 'desc';
            }
        }
        
        this.currentSort = { field, direction };
        
        this.filteredLogs.sort((a, b) => {
            let aVal = a[field];
            let bVal = b[field];
            
            if (field === 'timestamp') {
                aVal = new Date(aVal);
                bVal = new Date(bVal);
            }
            
            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });
        
        if (updateDisplay) {
            this.displayLogs();
            this.updateSortIcons();
        }
    }

    displayLogs() {
        const tbody = document.getElementById('logsTableBody');
        if (!tbody) return;
        
        const startIndex = (this.currentPage - 1) * this.logsPerPage;
        const endIndex = startIndex + this.logsPerPage;
        const pageData = this.filteredLogs.slice(startIndex, endIndex);
        
        if (pageData.length === 0) {
            tbody.innerHTML = `
                <tr class="no-data-row">
                    <td colspan="4">
                        <div class="no-data-message">
                            <i class="fas fa-search"></i>
                            <h3>No Activity Found</h3>
                            <p>No activity logs match your current filters</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = pageData.map(log => `
            <tr class="log-row" data-log-id="${log.id}" onclick="activityManager.showLogDetails('${log.id}')">
                <td class="log-timestamp">
                    <div class="timestamp-main">${this.formatDate(log.timestamp)}</div>
                    <div class="timestamp-sub">${this.formatTime(log.timestamp)}</div>
                </td>
                <td class="log-ip">
                    <span class="ip-address">${log.ipAddress}</span>
                    ${log.location ? `<div class="ip-location">${log.location}</div>` : ''}
                </td>
                <td class="log-username">
                    <span class="username">${log.username}</span>
                </td>
                <td class="log-status">
                    <span class="status-badge status-${log.status}">
                        ${this.getStatusIcon(log.status)} ${log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                    </span>
                </td>
            </tr>
        `).join('');
        
        // Update logs count
        document.getElementById('logsCount').textContent = 
            `Showing ${startIndex + 1}-${Math.min(endIndex, this.totalLogs)} of ${this.totalLogs.toLocaleString()} logs`;
    }

    async enhanceLocationData(ipAddress, locationData) {
        // If we already have good location data, use it
        if (locationData && locationData.city !== 'Unknown' && locationData.country !== 'Unknown') {
            return locationData;
        }

        try {
            // Try to get enhanced location data from ipapi.co
            console.log(`🌍 Enhancing location data for IP: ${ipAddress}`);
            
            const response = await fetch(`https://ipapi.co/${ipAddress}/json/`);
            if (response.ok) {
                const apiData = await response.json();
                console.log('🌍 Enhanced location data:', apiData);
                
                return {
                    city: apiData.city || locationData?.city || 'Unknown',
                    country: apiData.country_name || locationData?.country || 'Unknown',
                    country_code: apiData.country_code || locationData?.country_code || 'UN',
                    region: apiData.region || locationData?.region || 'Unknown',
                    isp: apiData.org || locationData?.isp || 'Unknown',
                    latitude: apiData.latitude || null,
                    longitude: apiData.longitude || null,
                    timezone: apiData.timezone || null,
                    postal: apiData.postal || null
                };
            }
        } catch (error) {
            console.warn('⚠️ Failed to enhance location data:', error);
        }
        
        // Return original data if enhancement fails
        return locationData || {
            city: 'Unknown',
            country: 'Unknown',
            country_code: 'UN',
            region: 'Unknown',
            isp: 'Unknown'
        };
    }

    async showLogDetails(logId) {
        const log = this.allLogs.find(l => l.id === logId);
        if (!log) return;
        
        this.selectedLog = log;
        
        // Show loading state
        const modalContent = document.getElementById('logDetailsContent');
        modalContent.innerHTML = `
            <div class="detail-section">
                <div class="logs-loading">
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>Loading detailed information...</span>
                </div>
            </div>
        `;
        const modalElement = document.getElementById('logDetailsModal');
        modalElement.style.display = 'flex';
        modalElement.classList.add('show');
        
        // Enhance location data in background
        const enhancedLocationData = await this.enhanceLocationData(log.ipAddress, log.locationData);
        log.locationData = enhancedLocationData;
        
        // Now populate the full modal content
        modalContent.innerHTML = `
            <div class="log-details-grid">
                <!-- Login Information Section -->
                <div class="detail-section">
                    <h3 class="section-title"><i class="fas fa-sign-in-alt"></i> Login Information</h3>
                    <div class="detail-row">
                        <div class="detail-group">
                            <h4><i class="fas fa-clock"></i> Login Time</h4>
                            <p class="timestamp-detailed">${this.formatFullTimestamp(log.timestamp)}</p>
                            <p class="detail-sub">Created: ${log.createdAt ? this.formatFullTimestamp(log.createdAt) : 'N/A'}</p>
                        </div>
                        <div class="detail-group">
                            <h4><i class="fas fa-info-circle"></i> Status</h4>
                            <span class="status-badge status-${log.status} large">
                                ${this.getStatusIcon(log.status)} ${log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                            </span>
                            ${log.failureReason ? `<p class="detail-sub text-danger">${log.failureReason}</p>` : ''}
                        </div>
                    </div>
                </div>

                <!-- User & Authentication Section -->
                <div class="detail-section">
                    <h3 class="section-title"><i class="fas fa-user-shield"></i> User & Authentication</h3>
                    <div class="detail-row">
                        <div class="detail-group">
                            <h4><i class="fas fa-user"></i> Username</h4>
                            <p class="username-display">${log.username}</p>
                        </div>
                        <div class="detail-group">
                            <h4><i class="fas fa-exclamation-triangle"></i> Failed Attempts</h4>
                            <p class="failed-attempts ${log.failedAttempts > 0 ? 'has-failures' : ''}">${log.failedAttempts} failed attempts</p>
                        </div>
                    </div>
                </div>

                <!-- Network & Location Section -->
                <div class="detail-section">
                    <h3 class="section-title"><i class="fas fa-globe"></i> Network & Location</h3>
                    <div class="detail-row">
                        <div class="detail-group">
                            <h4><i class="fas fa-map-marker-alt"></i> IP Address</h4>
                            <p class="ip-address-display">${log.ipAddress}</p>
                        </div>
                        <div class="detail-group location-group">
                            <h4><i class="fas fa-map"></i> Location Details</h4>
                            <div class="location-info">
                                <p><strong>City:</strong> ${log.locationData.city || 'Unknown'}</p>
                                <p><strong>Region:</strong> ${log.locationData.region || 'Unknown'}</p>
                                <p><strong>Country:</strong> ${log.locationData.country || 'Unknown'} ${log.locationData.country_code ? `(${log.locationData.country_code})` : ''}</p>
                                <p><strong>ISP:</strong> ${log.locationData.isp || 'Unknown'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Browser & Device Section -->
                <div class="detail-section">
                    <h3 class="section-title"><i class="fas fa-desktop"></i> Browser & Device Information</h3>
                    <div class="detail-row">
                        <div class="detail-group">
                            <h4><i class="fas fa-browser"></i> Browser Details</h4>
                            <div class="browser-info">
                                <p><strong>Browser:</strong> ${log.browserInfo.browser || 'Unknown'}</p>
                                <p><strong>Version:</strong> ${log.browserInfo.version || 'Unknown'}</p>
                                <p><strong>Operating System:</strong> ${log.browserInfo.os || 'Unknown'}</p>
                                <p><strong>Platform:</strong> ${log.browserInfo.platform || 'Unknown'}</p>
                            </div>
                        </div>
                        <div class="detail-group">
                            <h4><i class="fas fa-fingerprint"></i> Device Fingerprint</h4>
                            <p class="device-fingerprint">${log.deviceFingerprint || 'Not available'}</p>
                        </div>
                    </div>
                </div>

                <!-- User Agent Section -->
                <div class="detail-section">
                    <h3 class="section-title"><i class="fas fa-code"></i> User Agent String</h3>
                    <div class="detail-group">
                        <p class="user-agent">${log.userAgent}</p>
                    </div>
                </div>

                <!-- Security Analysis Section -->
                <div class="detail-section">
                    <h3 class="section-title"><i class="fas fa-shield-alt"></i> Security Analysis</h3>
                    <div class="detail-row">
                        <div class="detail-group">
                            <h4><i class="fas fa-chart-line"></i> Risk Assessment</h4>
                            <div class="risk-assessment">
                                <p><strong>Risk Score:</strong> 
                                    <span class="risk-score risk-${this.getRiskLevel(log.riskScore)}">${log.riskScore}/100</span>
                                    <span class="risk-label">(${this.getRiskLabel(log.riskScore)})</span>
                                </p>
                                <div class="risk-bar">
                                    <div class="risk-fill risk-${this.getRiskLevel(log.riskScore)}" style="width: ${log.riskScore}%"></div>
                                </div>
                            </div>
                        </div>
                        ${log.sessionDuration ? `
                        <div class="detail-group">
                            <h4><i class="fas fa-stopwatch"></i> Session Duration</h4>
                            <p>${this.formatDuration(log.sessionDuration)}</p>
                        </div>` : ''}
                    </div>
                </div>

                <!-- Technical Metadata Section -->
                <div class="detail-section">
                    <h3 class="section-title"><i class="fas fa-database"></i> Technical Metadata</h3>
                    <div class="detail-row">
                        <div class="detail-group">
                            <h4><i class="fas fa-key"></i> Record ID</h4>
                            <p class="record-id">${log.id}</p>
                        </div>
                        <div class="detail-group">
                            <h4><i class="fas fa-clock"></i> Last Updated</h4>
                            <p>${log.updatedAt ? this.formatFullTimestamp(log.updatedAt) : 'N/A'}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const logModal = document.getElementById('logDetailsModal');
        logModal.style.display = 'flex';
        logModal.classList.add('show');
    }

    closeLogModal() {
        const modal = document.getElementById('logDetailsModal');
        modal.style.display = 'none';
        modal.classList.remove('show');
        this.selectedLog = null;
    }

    // Utility functions
    formatDate(timestamp) {
        return new Date(timestamp).toLocaleDateString('en-AU', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }

    formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString('en-AU', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatFullTimestamp(timestamp) {
        return new Date(timestamp).toLocaleString('en-AU', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
        });
    }

    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }

    getStatusIcon(status) {
        switch (status) {
            case 'success': return '<i class="fas fa-check-circle"></i>';
            case 'failed': return '<i class="fas fa-times-circle"></i>';
            case 'blocked': return '<i class="fas fa-ban"></i>';
            case 'suspicious': return '<i class="fas fa-exclamation-triangle"></i>';
            default: return '<i class="fas fa-question-circle"></i>';
        }
    }

    getRiskLevel(score) {
        if (score >= 80) return 'high';
        if (score >= 50) return 'medium';
        return 'low';
    }

    getRiskLabel(score) {
        if (score >= 80) return 'High Risk';
        if (score >= 50) return 'Medium Risk';
        if (score >= 20) return 'Low Risk';
        return 'Minimal Risk';
    }

    updateSortIcons() {
        // Reset all sort icons
        document.querySelectorAll('.sort-icon').forEach(icon => {
            icon.className = 'fas fa-sort sort-icon';
        });
        
        // Update active sort icon
        const activeHeader = document.querySelector(`th[onclick="sortLogs('${this.currentSort.field}')"] .sort-icon`);
        if (activeHeader) {
            activeHeader.className = `fas fa-sort-${this.currentSort.direction === 'asc' ? 'up' : 'down'} sort-icon active`;
        }
    }

    updatePagination() {
        const totalPages = Math.ceil(this.totalLogs / this.logsPerPage);
        
        document.getElementById('paginationInfo').textContent = 
            `Page ${this.currentPage} of ${totalPages}`;
        
        document.getElementById('prevPage').disabled = this.currentPage <= 1;
        document.getElementById('nextPage').disabled = this.currentPage >= totalPages;
    }

    nextPage() {
        const totalPages = Math.ceil(this.totalLogs / this.logsPerPage);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.displayLogs();
            this.updatePagination();
        }
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.displayLogs();
            this.updatePagination();
        }
    }

    changeLogsPerPage() {
        const newLogsPerPage = parseInt(document.getElementById('logsPerPage').value);
        console.log(`🔄 Changing logs per page from ${this.logsPerPage} to ${newLogsPerPage}`);
        
        this.logsPerPage = newLogsPerPage;
        this.currentPage = 1;
        this.displayLogs();
        this.updatePagination();
        
        console.log(`✅ Now displaying ${this.logsPerPage} logs per page`);
    }

    resetFilters() {
        document.getElementById('dateFilter').value = '';
        document.getElementById('ipAddress').value = '';
        document.getElementById('status').value = '';
        this.initializeDateRange();
        this.applyFilters();
    }
}

// Global functions for HTML onclick handlers
function refreshActivityLogs() {
    activityManager.loadActivityLogs();
}

function exportActivityLogs() {
    // Export functionality
    console.log('Exporting activity logs...');
    // Implement CSV/JSON export
}

function clearOldLogs() {
    // Clear old logs functionality
    console.log('Clearing old logs...');
    // Implement with confirmation dialog
}

function applyFilters() {
    activityManager.applyFilters();
}

function resetFilters() {
    activityManager.resetFilters();
}

function sortLogs(field) {
    activityManager.sortLogs(field);
}

function nextPage() {
    activityManager.nextPage();
}

function previousPage() {
    activityManager.previousPage();
}

function changeLogsPerPage() {
    activityManager.changeLogsPerPage();
}

function closeLogModal() {
    activityManager.closeLogModal();
}

function exportSingleLog() {
    if (activityManager.selectedLog) {
        console.log('Exporting single log:', activityManager.selectedLog);
        // Implement single log export
    }
}

// Logout function
function performLogout() {
    console.log('🚪 Performing logout...');
    
    // Clear all stored authentication data
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userInfo');
    localStorage.removeItem('loginTimestamp');
    
    // Clear session storage
    sessionStorage.clear();
    
    // Redirect to login page
    window.location.href = 'index.html';
}

// Initialize when DOM is loaded
let activityManager;
document.addEventListener('DOMContentLoaded', () => {
    activityManager = new ActivityLogsManager();
});
