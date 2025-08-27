/**
 * Security Management System
 * Handles security monitoring, threat analysis, and admin security dashboard
 */

class SecurityManager {
    constructor() {
        this.API_BASE = 'https://api.teamsheldon.tech';
        this.charts = {};
        this.securityData = null;
        this.refreshInterval = 30000; // 30 seconds
        this.autoRefreshEnabled = true;
        
        this.init();
    }

    async init() {
        console.log('🛡️ Initializing Security Manager...');
        
        // Check authentication
        const token = localStorage.getItem('authToken');
        if (!token) {
            console.warn('⚠️ No auth token found, redirecting to login');
            window.location.href = 'index.html';
            return;
        }
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load user info
        await this.loadUserInfo();
        
        // Load security data
        await this.loadSecurityData();
        
        // Set up auto-refresh
        this.setupAutoRefresh();
        
        console.log('✅ Security Manager initialized successfully');
    }

    async loadUserInfo() {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                console.warn('⚠️ No auth token found');
                this.updateUserDisplay({
                    username: 'Admin User',
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

    async loadSecurityData() {
        try {
            console.log('🔍 Loading security data...');
            
            this.showLoadingState();
            
            // Use the new admin security API
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${this.API_BASE}/api/admin/security`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const securityData = await response.json();
            console.log('✅ Security data loaded:', securityData);

            this.securityData = securityData;
            this.displaySecurityDashboard(securityData);
            
        } catch (error) {
            console.error('❌ Error loading security data:', error);
            this.showErrorState(error.message);
        }
    }

    displaySecurityDashboard(data) {
        console.log('📊 Displaying security dashboard with data:', data);
        
        const container = document.getElementById('securityContent');
        if (!container) {
            console.error('❌ Security content container not found');
            return;
        }

        container.innerHTML = `
            <div class="security-header">
                <h2><i class="fas fa-shield-alt"></i> Security Dashboard</h2>
                <div class="security-controls">
                    <button class="btn-secondary" onclick="securityManager.refreshSecurityData()">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                    <button class="btn-toggle ${this.autoRefreshEnabled ? 'active' : ''}" onclick="securityManager.toggleAutoRefresh()">
                        <i class="fas fa-clock"></i> Auto-refresh
                    </button>
                </div>
            </div>

            <!-- Security Statistics -->
            <div class="security-stats">
                <div class="stat-card ${data.monitoring?.security?.level === 'high' ? 'danger' : data.monitoring?.security?.level === 'medium' ? 'warning' : 'safe'}">
                    <div class="stat-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div class="stat-content">
                        <h3>${data.monitoring?.security?.activeThreats || 0}</h3>
                        <p>Active Threats</p>
                        <span class="stat-change">${data.monitoring?.security?.level || 'Low'} Risk</span>
                    </div>
                </div>

                <div class="stat-card ${data.statistics?.logins?.failedToday > 10 ? 'warning' : 'info'}">
                    <div class="stat-icon">
                        <i class="fas fa-times-circle"></i>
                    </div>
                    <div class="stat-content">
                        <h3>${data.statistics?.logins?.failedToday || 0}</h3>
                        <p>Failed Logins Today</p>
                        <span class="stat-change">Total: ${data.statistics?.logins?.totalFailed || 0}</span>
                    </div>
                </div>

                <div class="stat-card info">
                    <div class="stat-icon">
                        <i class="fas fa-user-shield"></i>
                    </div>
                    <div class="stat-content">
                        <h3>${data.statistics?.users?.active || 0}</h3>
                        <p>Active Users</p>
                        <span class="stat-change">Total: ${data.statistics?.users?.total || 0}</span>
                    </div>
                </div>

                <div class="stat-card ${data.monitoring?.systemHealth?.overall === 'healthy' ? 'success' : 'warning'}">
                    <div class="stat-icon">
                        <i class="fas fa-server"></i>
                    </div>
                    <div class="stat-content">
                        <h3>${data.monitoring?.systemHealth?.overall || 'Unknown'}</h3>
                        <p>System Health</p>
                        <span class="stat-change">API: ${data.monitoring?.systemHealth?.apiHealth || 'Unknown'}</span>
                    </div>
                </div>
            </div>

            <!-- Security Charts -->
            <div class="security-charts">
                <div class="chart-container">
                    <div class="chart-header">
                        <h3><i class="fas fa-chart-line"></i> Login Attempts</h3>
                        <p>Success vs Failed login attempts over time</p>
                    </div>
                    <div class="chart-wrapper">
                        <canvas id="loginAttemptsChart"></canvas>
                    </div>
                </div>

                <div class="chart-container">
                    <div class="chart-header">
                        <h3><i class="fas fa-chart-pie"></i> Threat Distribution</h3>
                        <p>Types of security threats detected</p>
                    </div>
                    <div class="chart-wrapper">
                        <canvas id="threatDistributionChart"></canvas>
                    </div>
                </div>
            </div>

            <!-- Security Alerts -->
            <div class="security-alerts">
                <div class="alerts-header">
                    <h3><i class="fas fa-bell"></i> Recent Security Events</h3>
                    <span class="alerts-count">${data.alerts?.length || 0} alerts</span>
                </div>
                <div class="alerts-list">
                    ${this.renderSecurityAlerts(data.alerts || [])}
                </div>
            </div>

            <!-- Threat Analysis -->
            <div class="threat-analysis">
                <div class="analysis-header">
                    <h3><i class="fas fa-search"></i> Threat Analysis</h3>
                    <p>Detailed analysis of security threats and patterns</p>
                </div>
                <div class="analysis-content">
                    ${this.renderThreatAnalysis(data.analysis || {})}
                </div>
            </div>
        `;

        // Initialize charts
        this.initializeCharts(data);
    }

    renderSecurityAlerts(alerts) {
        if (!alerts || alerts.length === 0) {
            return `
                <div class="no-alerts">
                    <i class="fas fa-shield-check"></i>
                    <p>No security alerts at this time</p>
                    <small>System is operating normally</small>
                </div>
            `;
        }

        return alerts.slice(0, 10).map(alert => `
            <div class="alert-item ${alert.severity || 'info'}">
                <div class="alert-icon">
                    <i class="fas ${this.getAlertIcon(alert.type)}"></i>
                </div>
                <div class="alert-content">
                    <div class="alert-title">${alert.title || 'Security Alert'}</div>
                    <div class="alert-description">${alert.description || alert.message || 'No description available'}</div>
                    <div class="alert-meta">
                        <span class="alert-time">
                            <i class="fas fa-clock"></i> 
                            ${alert.timestamp ? new Date(alert.timestamp).toLocaleString() : 'Unknown time'}
                        </span>
                        <span class="alert-source">
                            <i class="fas fa-map-marker-alt"></i> 
                            ${alert.source || alert.ip || 'Unknown source'}
                        </span>
                    </div>
                </div>
                <div class="alert-severity">
                    <span class="severity-badge ${alert.severity || 'info'}">${alert.severity || 'Info'}</span>
                </div>
            </div>
        `).join('');
    }

    renderThreatAnalysis(analysis) {
        return `
            <div class="analysis-grid">
                <div class="analysis-card">
                    <h4><i class="fas fa-chart-bar"></i> Risk Assessment</h4>
                    <div class="risk-meter">
                        <div class="risk-level ${analysis.riskLevel || 'low'}">
                            ${(analysis.riskScore || 0)}%
                        </div>
                        <p>Overall Risk Score</p>
                    </div>
                </div>
                
                <div class="analysis-card">
                    <h4><i class="fas fa-globe"></i> Geographic Threats</h4>
                    <div class="geo-threats">
                        ${(analysis.geoThreats || []).slice(0, 5).map(threat => `
                            <div class="geo-threat">
                                <span class="country">${threat.country}</span>
                                <span class="count">${threat.count}</span>
                            </div>
                        `).join('') || '<p>No geographic threat data available</p>'}
                    </div>
                </div>
                
                <div class="analysis-card">
                    <h4><i class="fas fa-clock"></i> Attack Patterns</h4>
                    <div class="attack-patterns">
                        ${(analysis.attackPatterns || []).slice(0, 5).map(pattern => `
                            <div class="attack-pattern">
                                <span class="pattern">${pattern.type}</span>
                                <span class="frequency">${pattern.frequency}</span>
                            </div>
                        `).join('') || '<p>No attack pattern data available</p>'}
                    </div>
                </div>
                
                <div class="analysis-card">
                    <h4><i class="fas fa-shield-alt"></i> Recommendations</h4>
                    <div class="recommendations">
                        ${(analysis.recommendations || []).slice(0, 3).map(rec => `
                            <div class="recommendation">
                                <i class="fas fa-check-circle"></i>
                                <span>${rec}</span>
                            </div>
                        `).join('') || '<p>No specific recommendations at this time</p>'}
                    </div>
                </div>
            </div>
        `;
    }

    initializeCharts(data) {
        console.log('📊 Initializing security charts with data:', data);
        
        // Initialize login attempts chart
        this.initializeLoginAttemptsChart(data.analytics?.loginTrends || []);
        
        // Initialize threat distribution chart
        this.initializeThreatDistributionChart(data.analysis?.threatTypes || []);
    }

    initializeLoginAttemptsChart(loginTrends) {
        const ctx = document.getElementById('loginAttemptsChart');
        if (!ctx) {
            console.error('❌ Login attempts chart canvas not found');
            return;
        }

        const last30Days = loginTrends.slice(-30);
        
        this.charts.loginAttempts = new Chart(ctx, {
            type: 'line',
            data: {
                labels: last30Days.map(d => new Date(d.date).toLocaleDateString()),
                datasets: [
                    {
                        label: 'Successful Logins',
                        data: last30Days.map(d => d.successful || 0),
                        borderColor: '#28a745',
                        backgroundColor: 'rgba(40, 167, 69, 0.1)',
                        fill: true
                    },
                    {
                        label: 'Failed Attempts',
                        data: last30Days.map(d => d.failed || 0),
                        borderColor: '#dc3545',
                        backgroundColor: 'rgba(220, 53, 69, 0.1)',
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#f0f0f0'
                        }
                    },
                    x: {
                        grid: {
                            color: '#f0f0f0'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top'
                    }
                }
            }
        });
    }

    initializeThreatDistributionChart(threatTypes) {
        const ctx = document.getElementById('threatDistributionChart');
        if (!ctx) {
            console.error('❌ Threat distribution chart canvas not found');
            return;
        }

        // Default threat types if no data available
        const defaultThreats = [
            { type: 'Brute Force', count: 0 },
            { type: 'SQL Injection', count: 0 },
            { type: 'XSS', count: 0 },
            { type: 'DDoS', count: 0 },
            { type: 'Other', count: 0 }
        ];

        const threats = threatTypes.length > 0 ? threatTypes : defaultThreats;
        
        this.charts.threatDistribution = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: threats.map(t => t.type),
                datasets: [{
                    data: threats.map(t => t.count),
                    backgroundColor: [
                        '#ff6384',
                        '#36a2eb',
                        '#cc65fe',
                        '#ffce56',
                        '#ff9f40'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right'
                    }
                }
            }
        });
    }

    getAlertIcon(type) {
        const iconMap = {
            'login': 'fa-sign-in-alt',
            'brute_force': 'fa-hammer',
            'sql_injection': 'fa-database',
            'xss': 'fa-code',
            'ddos': 'fa-tachometer-alt',
            'system': 'fa-server',
            'security': 'fa-shield-alt'
        };
        return iconMap[type] || 'fa-exclamation-triangle';
    }

    setupEventListeners() {
        // Add keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                this.refreshSecurityData();
            }
        });
    }

    setupAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }

        if (this.autoRefreshEnabled) {
            this.autoRefreshInterval = setInterval(() => {
                console.log('🔄 Auto-refreshing security data...');
                this.loadSecurityData();
            }, this.refreshInterval);
        }
    }

    toggleAutoRefresh() {
        this.autoRefreshEnabled = !this.autoRefreshEnabled;
        console.log('🔄 Auto-refresh toggled:', this.autoRefreshEnabled);
        
        const button = document.querySelector('.btn-toggle');
        if (button) {
            button.classList.toggle('active', this.autoRefreshEnabled);
        }
        
        this.setupAutoRefresh();
        
        if (window.notificationManager) {
            window.notificationManager.info(
                `Auto-refresh ${this.autoRefreshEnabled ? 'enabled' : 'disabled'}`, 
                3000
            );
        }
    }

    async refreshSecurityData() {
        console.log('🔄 Manually refreshing security data...');
        await this.loadSecurityData();
        
        if (window.notificationManager) {
            window.notificationManager.success('Security data refreshed', 3000);
        }
    }

    showLoadingState() {
        const container = document.getElementById('securityContent');
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner">
                        <i class="fas fa-shield-alt fa-spin"></i>
                    </div>
                    <h3>Loading Security Data...</h3>
                    <p>Please wait while we gather security information</p>
                </div>
            `;
        }
    }

    showErrorState(errorMessage) {
        const container = document.getElementById('securityContent');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h3>Failed to Load Security Data</h3>
                    <p>Error: ${errorMessage}</p>
                    <button class="btn-primary" onclick="securityManager.loadSecurityData()">
                        <i class="fas fa-sync-alt"></i> Retry
                    </button>
                </div>
            `;
        }
    }

    setElementText(id, text) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = text;
        }
    }
}

// Initialize security manager when page loads
let securityManager;

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Security Manager...');
    securityManager = new SecurityManager();
});

// Make securityManager available globally
window.securityManager = securityManager;
