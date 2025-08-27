// User Info Display Fix for Admin Panel
// This script ensures user information displays correctly in the sidebar

console.log('👤 Loading User Info Display Fixes...');

// Enhanced user info loader with multiple fallbacks
function loadUserInfoWithFallbacks() {
    console.log('🔄 Loading user info with comprehensive fallbacks...');
    
    try {
        // Try multiple localStorage keys
        let username = localStorage.getItem('username') || 
                      localStorage.getItem('userEmail') || 
                      localStorage.getItem('user') ||
                      localStorage.getItem('adminUsername');
                      
        let userRole = localStorage.getItem('userRole') || 
                      localStorage.getItem('role') || 
                      localStorage.getItem('adminRole') ||
                      'Administrator';
                      
        let userEmail = localStorage.getItem('userEmail') || 
                       localStorage.getItem('email') || 
                       localStorage.getItem('username');
        
        // Clean up username if it contains @ symbol
        if (username && username.includes('@')) {
            const emailParts = username.split('@');
            if (!userEmail) userEmail = username;
            username = emailParts[0];
        }
        
        // Set reasonable defaults
        if (!username) username = 'Admin User';
        if (!userEmail) userEmail = username.includes('@') ? username : 'admin@teamsheldon.tech';
        if (!userRole) userRole = 'Administrator';
        
        console.log('📝 Processed user info:', { username, userRole, userEmail });
        
        // Update sidebar elements safely
        updateUserInfoElements(username, userRole, userEmail);
        
        // Try to fetch fresh info from API in background
        fetchFreshUserInfo();
        
    } catch (error) {
        console.error('❌ Error in user info loading:', error);
        // Use absolute fallbacks
        updateUserInfoElements('Admin User', 'Administrator', 'admin@teamsheldon.tech');
    }
}

function updateUserInfoElements(username, userRole, userEmail) {
    // Safely update each element
    const elements = [
        { id: 'sidebarUserName', value: username },
        { id: 'sidebarUserRole', value: userRole },
        { id: 'sidebarUserEmail', value: userEmail }
    ];
    
    elements.forEach(({ id, value }) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
            console.log(`✅ Updated ${id}: ${value}`);
        } else {
            console.warn(`⚠️ Element not found: ${id}`);
            // Try alternative selectors
            const altElement = document.querySelector(`[data-user-info="${id}"]`) || 
                              document.querySelector(`.${id}`) ||
                              document.querySelector(`#${id.replace('sidebar', '')}`);
            if (altElement) {
                altElement.textContent = value;
                console.log(`✅ Updated ${id} via alternative selector: ${value}`);
            }
        }
    });
}

async function fetchFreshUserInfo() {
    try {
        const token = localStorage.getItem('authToken') || 
                     localStorage.getItem('adminToken') ||
                     localStorage.getItem('token');
                     
        if (!token) {
            console.log('ℹ️ No auth token available for fresh user info fetch');
            return;
        }
        
        console.log('🔄 Attempting to fetch fresh user info from API...');
        
        const response = await fetch('https://api.teamsheldon.tech/api/user/profile', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const userInfo = await response.json();
            console.log('✅ Fresh user info from API:', userInfo);
            
            // Update with fresh data
            const username = userInfo.username || userInfo.name || localStorage.getItem('username') || 'Admin User';
            const userRole = userInfo.role || userInfo.userRole || localStorage.getItem('userRole') || 'Administrator';
            const userEmail = userInfo.email || userInfo.userEmail || localStorage.getItem('userEmail') || 'admin@teamsheldon.tech';
            
            // Store fresh data
            localStorage.setItem('username', username);
            localStorage.setItem('userRole', userRole);
            localStorage.setItem('userEmail', userEmail);
            localStorage.setItem('userInfo', JSON.stringify(userInfo));
            
            // Update display
            updateUserInfoElements(username, userRole, userEmail);
            
        } else {
            console.log('⚠️ Could not fetch fresh user info, using stored data');
        }
    } catch (error) {
        console.log('⚠️ API user info fetch failed:', error.message);
    }
}

// Auto-retry function for user info loading
function retryUserInfoLoad() {
    console.log('🔄 Retrying user info load...');
    loadUserInfoWithFallbacks();
}

// Initialize user info when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM loaded, initializing user info...');
    
    // Initial load
    loadUserInfoWithFallbacks();
    
    // Retry after a delay in case elements aren't ready yet
    setTimeout(() => {
        console.log('⏰ Delayed user info update...');
        loadUserInfoWithFallbacks();
    }, 2000);
    
    // Set up periodic refresh
    setInterval(() => {
        const hasElements = document.getElementById('sidebarUserName') || 
                           document.getElementById('sidebarUserRole') || 
                           document.getElementById('sidebarUserEmail');
        if (hasElements) {
            fetchFreshUserInfo();
        }
    }, 30000); // Refresh every 30 seconds
});

// Handle visibility change - refresh when tab becomes visible
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        console.log('👁️ Tab became visible, refreshing user info...');
        setTimeout(loadUserInfoWithFallbacks, 1000);
    }
});

// Make functions available globally
window.loadUserInfoWithFallbacks = loadUserInfoWithFallbacks;
window.retryUserInfoLoad = retryUserInfoLoad;
window.updateUserInfoElements = updateUserInfoElements;

console.log('✅ User Info Display Fixes loaded');
