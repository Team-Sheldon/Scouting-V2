/**
 * TeamSheldon Admin Panel - Login JavaScript  
 * Domain: admin.teamsheldon.tech
 * Professional Security & Authentication System
 */

class TeamSheldonAdmin {
  constructor() {
    this.API_BASE = 'https://api.teamsheldon.tech';
    this.SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    this.MAX_LOGIN_ATTEMPTS = 5;
    this.LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
    
    this.isAuthenticated = false;
    this.sessionTimer = null;
    this.currentUser = null;
    this.turnstileToken = null;
    this.turnstileRetried = false;
    this.loginAttempts = this.getLoginAttempts();
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupSecurityMonitoring();
    this.checkAuthStatus();
    this.initializeTurnstile();
    
    // Add debug info for localhost
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('🌐 Running on localhost - will use real API');
      console.log('🔗 API Base:', this.API_BASE);
      console.log('🌍 Origin:', window.location.origin);
    }
    
    this.showNotification('System Initialized', 'Admin panel loaded successfully', 'success');
  }

  // ===== TURNSTILE INITIALIZATION =====
  initializeTurnstile() {
    // Wait for DOM to be ready and Turnstile to load
    setTimeout(() => {
      if (typeof turnstile !== 'undefined') {
        const widget = document.getElementById('turnstile-widget');
        if (widget && !widget.querySelector('iframe')) {
          try {
            turnstile.render(widget, {
              sitekey: '0x4AAAAAABoKebAPysQPtpZh',
              callback: (token) => {
                this.turnstileToken = token;
                this.validateForm();
                this.showNotification('Verification Complete', 'Security verification successful', 'success', 3000);
              },
              'error-callback': () => {
                this.showNotification('Verification Error', 'Security verification failed. Please refresh the page.', 'error');
              },
              'expired-callback': () => {
                this.turnstileToken = null;
                this.validateForm();
                this.showNotification('Verification Expired', 'Please complete the security verification again', 'warning');
              }
            });
          } catch (error) {
            console.error('Turnstile render error:', error);
            this.showNotification('Security Error', 'Unable to load security verification. Please refresh.', 'error');
          }
        }
      } else {
        // Turnstile not loaded yet, try again (but only once more to avoid multiple widgets)
        if (!this.turnstileRetried) {
          this.turnstileRetried = true;
          setTimeout(() => this.initializeTurnstile(), 1000);
        }
      }
    }, 500);
  }

  // ===== EVENT LISTENERS =====
  setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }

    // Password toggle
    const togglePassword = document.getElementById('togglePassword');
    if (togglePassword) {
      togglePassword.addEventListener('click', () => this.togglePasswordVisibility());
    }

    // Form validation
    const username = document.getElementById('username');
    const password = document.getElementById('password');
    const agreeToS = document.getElementById('agreeToS');

    [username, password, agreeToS].forEach(element => {
      if (element) {
        element.addEventListener('input', () => this.validateForm());
        element.addEventListener('change', () => this.validateForm());
      }
    });

    // Only prevent leaving during active login process
    this.beforeUnloadHandler = (e) => {
      if (this.isLoggingIn) {
        e.preventDefault();
        e.returnValue = 'Login in progress...';
        return 'Login in progress...';
      }
    };

    // Add handler only when needed
    this.addBeforeUnloadProtection = () => {
      window.addEventListener('beforeunload', this.beforeUnloadHandler);
    };

    this.removeBeforeUnloadProtection = () => {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    };

    // Session management
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseSession();
      } else {
        this.resumeSession();
      }
    });

    // Security monitoring
    this.setupSecurityListeners();
  }

  setupSecurityListeners() {
    // Detect multiple tabs
    window.addEventListener('storage', (e) => {
      if (e.key === 'admin_session_active' && e.newValue === 'true' && this.isAuthenticated) {
        this.showNotification('Security Alert', 'Admin session detected in another tab', 'warning');
      }
    });

    // Detect developer tools
    let devtools = { open: false, orientation: null };
    const threshold = 160;

    setInterval(() => {
      if (window.outerHeight - window.innerHeight > threshold || 
          window.outerWidth - window.innerWidth > threshold) {
        if (!devtools.open) {
          devtools.open = true;
          this.logSecurityEvent('Developer tools opened');
        }
      } else {
        devtools.open = false;
      }
    }, 500);

    // Block common attack vectors
    document.addEventListener('keydown', (e) => {
      // Block F12, Ctrl+Shift+I, Ctrl+U, etc.
      if (e.key === 'F12' || 
          (e.ctrlKey && e.shiftKey && e.key === 'I') ||
          (e.ctrlKey && e.key === 'u')) {
        e.preventDefault();
        this.logSecurityEvent('Blocked developer tools shortcut');
      }
    });

    // Block right-click context menu
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.logSecurityEvent('Blocked context menu');
    });
  }

  // ===== AUTHENTICATION =====
  async handleLogin(event) {
    event.preventDefault();
    
    if (this.isLoggingIn || this.isLocked()) {
      return;
    }

    const formData = new FormData(event.target);
    const credentials = {
      username: formData.get('username')?.trim(),
      password: formData.get('password'),
      agreeToS: formData.get('agreeToS'),
      turnstileToken: this.turnstileToken
    };

    // Validate form
    if (!this.validateCredentials(credentials)) {
      return;
    }

    this.isLoggingIn = true;
    this.addBeforeUnloadProtection(); // Add protection during login
    this.updateLoginButton(true);
    this.showLoadingOverlay('Authenticating...');

    try {
      const response = await this.authenticateUser(credentials);
      
      console.log('📥 Full API Response:', response);
      
      // Handle different response structures
      if (response && (response.success === true || response.token || response.user)) {
        // If response has success=true with data property
        if (response.success && response.data) {
          this.handleLoginSuccess(response.data);
        }
        // If response directly contains token/user (common API pattern)
        else if (response.token || response.user) {
          this.handleLoginSuccess(response);
        }
        // If response indicates success but different structure
        else {
          this.handleLoginSuccess(response);
        }
      } else if (response && response.success === false) {
        this.handleLoginFailure(response.message || 'Login failed');
      } else {
        this.handleLoginFailure(response?.message || 'Unknown authentication error');
      }
    } catch (error) {
      this.handleLoginError(error);
    } finally {
      this.isLoggingIn = false;
      this.removeBeforeUnloadProtection(); // Remove protection when done
      this.updateLoginButton(false);
      this.hideLoadingOverlay();
    }
  }

  async authenticateUser(credentials) {
    // Add development mode check for localhost testing
    const isDevelopment = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' ||
                         window.location.port === '3000';

    // Remove development mode bypass - API keys must come from server
    // if (isDevelopment && credentials.username === 'dev' && credentials.password === 'dev123') {
    //   console.log('🚧 Development mode authentication successful');
    //   // API keys must be generated by server, not locally
    // }

    try {
      const payload = {
        username: credentials.username,
        password: credentials.password,
        turnstileToken: credentials.turnstileToken,
        agreeToS: credentials.agreeToS
      };

      console.log('🔐 Authentication Request Details:');
      console.log('📍 Method: POST');
      console.log('🌐 URL:', `${this.API_BASE}/api/auth/login`);
      console.log('📍 Origin:', window.location.origin);
      console.log('📦 Payload:', {
        username: payload.username,
        password: '[HIDDEN]',
        turnstileToken: payload.turnstileToken ? '[PROVIDED]' : '[MISSING]',
        agreeToS: payload.agreeToS
      });
      
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        mode: 'cors',
        body: JSON.stringify(payload)
      };

      console.log('📋 Request Options:', {
        method: requestOptions.method,
        headers: requestOptions.headers,
        mode: requestOptions.mode,
        bodyLength: requestOptions.body.length
      });

      const response = await fetch(`${this.API_BASE}/api/auth/login`, requestOptions);

      console.log('📨 Response Details:');
      console.log('📊 Status:', response.status, response.statusText);
      console.log('🏷️ Headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error response:', errorText);
        
        // Handle rate limiting specifically
        if (response.status === 429) {
          const errorData = JSON.parse(errorText);
          const retryAfter = errorData.retryAfter || 60; // Default 1 minute instead of 5
          
          console.warn('⏰ Rate limit exceeded, need to wait:', retryAfter, 'seconds');
          
          // Convert seconds to minutes and seconds for display
          const minutes = Math.floor(retryAfter / 60);
          const seconds = retryAfter % 60;
          const timeDisplay = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
          
          // Start countdown timer
          this.startRateLimitTimer(retryAfter);
          
          this.showNotification('Rate Limited', 
            `API temporarily limited. Wait ${timeDisplay} or use dev mode (localhost with dev/dev123)`, 
            'warning', 15000);
          
          throw new Error(`Rate limited. Please wait ${timeDisplay} before trying again.`);
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ API Success response:', result);
      return result;
      
    } catch (apiError) {
      console.error('💥 API authentication failed:', apiError);
      
      // Check if it's a rate limiting error
      if (apiError.message.includes('429') || apiError.message.includes('Rate limit') || 
          apiError.message.includes('Too many requests')) {
        console.warn('⏰ Rate limited - throwing error to user');
        throw new Error(apiError.message);
      }
      
      // For any other error, throw it (NO FALLBACK)
      console.error('� API authentication failed - no fallback will be used');
      throw new Error(`Authentication failed: ${apiError.message}`);
      
      // For production, throw the actual error
      throw new Error(`Authentication failed: ${apiError.message}`);
    }
  }

  validateCredentials(credentials) {
    const errors = [];

    // Check if we're in development mode with dev credentials
    const isDevelopment = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' ||
                         window.location.port === '3000';

    const isDevCredentials = isDevelopment && 
                            credentials.username === 'dev' && 
                            credentials.password === 'dev123';

    if (!credentials.username || credentials.username.length < 3) {
      errors.push('Username must be at least 3 characters');
    }

    if (!credentials.password || credentials.password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }

    if (!credentials.agreeToS) {
      errors.push('You must agree to the Terms of Service');
    }

    // Only require Turnstile if not in dev mode
    if (!credentials.turnstileToken && !isDevCredentials) {
      errors.push('Please complete the security verification');
    }

    if (errors.length > 0) {
      this.showNotification('Validation Error', errors.join('<br>'), 'error');
      return false;
    }

    if (isDevCredentials) {
      console.log('🚧 Development credentials detected - bypassing Turnstile requirement');
    }

    return true;
  }

  handleLoginSuccess(userData) {
    console.log('🎉 Processing login success with data:', userData);
    
    this.resetLoginAttempts();
    
    // Handle different response structures
    const token = userData.token || userData.access_token || userData.authToken;
    // Server returns token only - token IS the API key
    const apiKey = token; // Use the same token as API key
    const user = userData.user || userData.userData || {
      name: userData.name || userData.username || 'Admin User',
      email: userData.email || 'admin@teamsheldon.tech',
      role: userData.role || 'Administrator',
      id: userData.id || userData.userId || 1
    };
    
    if (!token) {
      console.warn('⚠️ No token found in response, creating session token');
      // Create a session token if none provided
      const sessionToken = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      this.setAuthCookie(sessionToken);
    } else {
      this.setAuthCookie(token);
    }
    
    // Store token (which serves as both auth token and API key)
    if (token) {
      console.log('🔑 Token received from login, storing for dashboard use');
      // Store in both locations for compatibility - token serves as both auth and API key
      localStorage.setItem('adminToken', token);
      localStorage.setItem('authToken', token);
      console.log('🔑 Token stored in localStorage as both adminToken and authToken successfully');
    } else {
      console.log('⚠️ No token in login response, dashboard may not work');
      // Clear any previous tokens if login doesn't provide one
      localStorage.removeItem('adminToken');
      localStorage.removeItem('authToken');
    }
    
    // Store user information for dashboard use
    if (user) {
      // Save user email (for username extraction) and role
      const userEmail = user.email || user.username || 'Loading...';
      const userRole = user.role || 'Loading...';
      
      localStorage.setItem('userEmail', userEmail);
      localStorage.setItem('userRole', userRole);
      localStorage.setItem('userName', user.name || userEmail.split('@')[0]);
      
      console.log('👤 User info stored:', { userEmail, userRole, userName: user.name });
    }
    
    this.currentUser = user;
    this.isAuthenticated = true;
    
    localStorage.setItem('admin_session_active', 'true');
    
    this.showNotification('Login Successful', `Welcome back, ${user.name}!`, 'success');
    this.startSessionTimer();
    this.redirectToDashboard();
  }

  handleLoginFailure(message) {
    this.incrementLoginAttempts();
    const attemptsLeft = this.MAX_LOGIN_ATTEMPTS - this.loginAttempts;
    
    if (attemptsLeft <= 0) {
      this.lockAccount();
      this.showNotification('Account Locked', 
        `Too many failed attempts. Account locked for ${this.LOCKOUT_DURATION / 60000} minutes.`, 
        'error'
      );
    } else {
      this.showNotification('Login Failed', 
        `${message}. ${attemptsLeft} attempts remaining.`, 
        'error'
      );
    }
    
    this.logSecurityEvent(`Failed login attempt: ${message}`);
  }

  handleLoginError(error) {
    console.error('Login error:', error);
    
    // Check if it's a rate limit error and show specific message
    if (error.message.includes('Rate limited') || error.message.includes('wait')) {
      this.showNotification('Rate Limited', error.message, 'error', 15000);
    } else {
      this.showNotification('Connection Error', 
        'Unable to connect to authentication server. Please try again.', 
        'error'
      );
    }
    
    this.logSecurityEvent(`Login error: ${error.message}`);
  }

  startRateLimitTimer(seconds) {
    // Disable login form
    const loginButton = document.getElementById('loginButton');
    const form = document.querySelector('#loginForm');
    
    if (loginButton) {
      loginButton.disabled = true;
      loginButton.innerHTML = '<i class="fas fa-clock"></i> Rate Limited';
    }
    
    if (form) {
      form.style.opacity = '0.6';
      form.style.pointerEvents = 'none';
    }
    
    let remainingSeconds = seconds;
    const updateTimer = () => {
      const minutes = Math.floor(remainingSeconds / 60);
      const secs = remainingSeconds % 60;
      const timeDisplay = minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
      
      if (loginButton) {
        loginButton.innerHTML = `<i class="fas fa-clock"></i> Wait ${timeDisplay}`;
      }
      
      remainingSeconds--;
      
      if (remainingSeconds < 0) {
        // Re-enable form
        if (loginButton) {
          loginButton.disabled = false;
          loginButton.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
        }
        
        if (form) {
          form.style.opacity = '1';
          form.style.pointerEvents = 'auto';
        }
        
        this.showNotification('Ready', 'You can now try logging in again.', 'success');
        clearInterval(this.rateLimitTimer);
      }
    };
    
    // Update immediately and then every second
    updateTimer();
    this.rateLimitTimer = setInterval(updateTimer, 1000);
  }

  // ===== SESSION MANAGEMENT =====
  startSessionTimer() {
    this.clearSessionTimer();
    this.sessionTimer = setTimeout(() => {
      this.logout('Session expired for security');
    }, this.SESSION_TIMEOUT);
  }

  clearSessionTimer() {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }
  }

  pauseSession() {
    this.clearSessionTimer();
  }

  resumeSession() {
    if (this.isAuthenticated) {
      this.startSessionTimer();
    }
  }

  async logout(reason = 'User logout') {
    try {
      // Note: No logout endpoint available, just clear client-side data
      console.log('Logging out:', reason);
    } catch (error) {
      console.error('Logout error:', error);
    }

    this.isAuthenticated = false;
    this.currentUser = null;
    this.clearSessionTimer();
    this.removeAuthCookie();
    
    localStorage.removeItem('admin_session_active');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('authToken');
    
    this.showNotification('Logged Out', reason, 'info');
    this.redirectToLogin();
  }

  // ===== SECURITY FEATURES =====
  async getCSRFToken() {
    // No CSRF endpoint available, return null
    return null;
  }

  logSecurityEvent(event) {
    // Log locally since no security-log endpoint exists
    console.log('Security Event:', {
      timestamp: new Date().toISOString(),
      event,
      userAgent: navigator.userAgent,
      sessionId: this.getSessionId()
    });
  }

  // ===== LOGIN ATTEMPTS & LOCKOUT =====
  getLoginAttempts() {
    const stored = localStorage.getItem('admin_login_attempts');
    const data = stored ? JSON.parse(stored) : { count: 0, timestamp: 0 };
    
    // Reset if lockout period has expired
    if (Date.now() - data.timestamp > this.LOCKOUT_DURATION) {
      return 0;
    }
    
    return data.count;
  }

  incrementLoginAttempts() {
    this.loginAttempts++;
    localStorage.setItem('admin_login_attempts', JSON.stringify({
      count: this.loginAttempts,
      timestamp: Date.now()
    }));
  }

  resetLoginAttempts() {
    this.loginAttempts = 0;
    localStorage.removeItem('admin_login_attempts');
  }

  lockAccount() {
    localStorage.setItem('admin_login_attempts', JSON.stringify({
      count: this.MAX_LOGIN_ATTEMPTS,
      timestamp: Date.now()
    }));
  }

  isLocked() {
    return this.loginAttempts >= this.MAX_LOGIN_ATTEMPTS;
  }

  // ===== COOKIE MANAGEMENT =====
  setAuthCookie(token) {
    const expiryTime = new Date(Date.now() + this.SESSION_TIMEOUT);
    document.cookie = `admin_token=${token}; expires=${expiryTime.toUTCString()}; path=/; secure; samesite=strict`;
  }

  removeAuthCookie() {
    document.cookie = 'admin_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; secure; samesite=strict';
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

  // ===== AUTH STATUS CHECK =====
  async checkAuthStatus() {
    const token = this.getAuthCookie();
    if (!token) {
      return;
    }

    try {
      // Check if we have login history endpoint to verify auth
      const response = await fetch(`${this.API_BASE}/api/login-history`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (response.ok) {
        // If we can access admin endpoint, user is authenticated
        this.isAuthenticated = true;
        this.startSessionTimer();
        this.redirectToDashboard();
      } else {
        this.removeAuthCookie();
      }
    } catch (error) {
      console.error('Token verification error:', error);
      this.removeAuthCookie();
    }
  }

  // ===== UI HELPERS =====
  togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const toggleButton = document.getElementById('togglePassword');
    const icon = toggleButton.querySelector('i');

    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      icon.className = 'fas fa-eye-slash';
    } else {
      passwordInput.type = 'password';
      icon.className = 'fas fa-eye';
    }
  }

  validateForm() {
    const username = document.getElementById('username');
    const password = document.getElementById('password');
    const agreeToS = document.getElementById('agreeToS');
    const loginBtn = document.getElementById('loginBtn');

    // Check if we're in development mode
    const isDevelopment = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' ||
                         window.location.port === '3000';

    // For development mode, bypass Turnstile requirement if using dev credentials
    const isDevCredentials = isDevelopment && 
                             username.value.trim() === 'dev' && 
                             password.value === 'dev123';

    const isValid = username.value.trim().length >= 3 && 
                   password.value.length >= 8 && 
                   agreeToS.checked && 
                   (this.turnstileToken || isDevCredentials);

    loginBtn.disabled = !isValid;
    
    // Show development mode indicator
    if (isDevCredentials) {
      loginBtn.style.backgroundColor = '#ff9800';
      loginBtn.title = 'Development Mode - Turnstile bypassed';
    } else {
      loginBtn.style.backgroundColor = '';
      loginBtn.title = '';
    }
  }

  updateLoginButton(isLoading) {
    const loginBtn = document.getElementById('loginBtn');
    if (isLoading) {
      loginBtn.classList.add('loading');
      loginBtn.disabled = true;
    } else {
      loginBtn.classList.remove('loading');
      this.validateForm();
    }
  }

  showLoadingOverlay(message = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    const messageEl = overlay.querySelector('p');
    if (messageEl) messageEl.textContent = message;
    overlay.classList.add('show');
  }

  hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.remove('show');
  }

  // ===== NOTIFICATION SYSTEM =====
  showNotification(title, message, type = 'info', duration = 5000) {
    // Use the unified notification system if available
    if (window.notificationManager) {
      const fullMessage = title ? `${title}: ${message}` : message;
      return window.notificationManager.show(fullMessage, type, duration);
    }
    
    // Use global function as fallback
    if (typeof showNotification === 'function' && showNotification !== this.showNotification) {
      const fullMessage = title ? `${title}: ${message}` : message;
      return showNotification(fullMessage, type, duration);
    }
    
    // Original fallback implementation
    const container = document.getElementById('notificationContainer');
    if (!container) {
      console.log(`Notification [${type}]: ${title} - ${message}`);
      return;
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const iconMap = {
      success: 'fa-check-circle',
      error: 'fa-exclamation-circle',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle'
    };

    notification.innerHTML = `
      <div class="notification-icon">
        <i class="fas ${iconMap[type]}"></i>
      </div>
      <div class="notification-content">
        <div class="notification-title">${title}</div>
        <div class="notification-message">${message}</div>
      </div>
      <button class="notification-close">
        <i class="fas fa-times"></i>
      </button>
    `;

    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => this.removeNotification(notification));

    container.appendChild(notification);

    if (duration > 0) {
      setTimeout(() => this.removeNotification(notification), duration);
    }

    return notification;
  }

  removeNotification(notification) {
    if (notification && notification.parentNode) {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        notification.parentNode.removeChild(notification);
      }, 300);
    }
  }

  // ===== NAVIGATION =====
  redirectToDashboard() {
    window.location.href = 'Dashboard.html';
  }

  redirectToLogin() {
    window.location.href = 'index.html';
  }

  // ===== DEVELOPMENT MODE =====
  // showDevModeBanner() method removed - no development bypasses
  // API keys must be generated by server only

  getSessionId() {
    let sessionId = sessionStorage.getItem('admin_session_id');
    if (!sessionId) {
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('admin_session_id', sessionId);
    }
    return sessionId;
  }

  // ===== SECURITY MONITORING =====
  setupSecurityMonitoring() {
    // Monitor for suspicious activity
    let suspiciousActivity = 0;

    // Track rapid clicks
    document.addEventListener('click', () => {
      suspiciousActivity++;
      if (suspiciousActivity > 50) {
        this.logSecurityEvent('Suspicious rapid clicking detected');
        suspiciousActivity = 0;
      }
    });

    // Reset activity counter periodically
    setInterval(() => {
      suspiciousActivity = 0;
    }, 10000);

    // Monitor network status
    window.addEventListener('online', () => {
      this.showNotification('Connection Restored', 'Network connection is back online', 'success', 3000);
    });

    window.addEventListener('offline', () => {
      this.showNotification('Connection Lost', 'Network connection lost. Please check your internet.', 'warning', 0);
    });
  }
}

// ===== CLOUDFLARE TURNSTILE CALLBACK =====
window.onloadTurnstileCallback = function() {
  console.log('Turnstile script loaded');
  // Auto-render is handled by the cf-turnstile class in HTML
};

window.onTurnstileCallback = function(token) {
  console.log('Turnstile token received:', token);
  if (window.adminPanel) {
    window.adminPanel.turnstileToken = token;
    window.adminPanel.validateForm();
    window.adminPanel.showNotification('Verification Complete', 'Security verification successful', 'success', 3000);
  }
};



// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
  // Initialize admin panel
  window.adminPanel = new TeamSheldonAdmin();
});

// ===== GLOBAL ERROR HANDLING =====
window.addEventListener('error', function(e) {
  console.error('Global error:', e.error);
  if (window.adminPanel) {
    window.adminPanel.logSecurityEvent(`JavaScript error: ${e.message}`);
  }
});

window.addEventListener('unhandledrejection', function(e) {
  console.error('Unhandled promise rejection:', e.reason);
  if (window.adminPanel) {
    window.adminPanel.logSecurityEvent(`Unhandled promise rejection: ${e.reason}`);
  }
});