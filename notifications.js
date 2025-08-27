/**
 * Unified Notification System for TeamSheldon Admin Panel
 * Persistent notifications that work across all pages
 */

class NotificationManager {
    constructor() {
        this.STORAGE_KEY = 'admin_notifications';
        this.MAX_STORED_NOTIFICATIONS = 5;
        this.container = null;
        this.init();
    }

    init() {
        this.createContainer();
        this.loadStoredNotifications();
        this.setupStyles();
        
        // Make globally available
        window.notificationManager = this;
        
        console.log('📢 Notification Manager initialized');
    }

    createContainer() {
        // Remove any existing container
        const existing = document.querySelector('.notifications-container');
        if (existing) {
            existing.remove();
        }

        // Create new container
        this.container = document.createElement('div');
        this.container.className = 'notifications-container';
        this.container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
            max-width: 400px;
        `;
        
        document.body.appendChild(this.container);
    }

    setupStyles() {
        // Add CSS animations if not already present
        if (!document.querySelector('#notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes notificationSlideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                
                @keyframes notificationSlideOut {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
                
                .notification-toast {
                    animation: notificationSlideIn 0.3s ease-out;
                    pointer-events: all;
                    cursor: pointer;
                    transition: transform 0.2s ease;
                }
                
                .notification-toast:hover {
                    transform: scale(1.02);
                }
                
                .notification-toast.removing {
                    animation: notificationSlideOut 0.3s ease-out forwards;
                }
            `;
            document.head.appendChild(style);
        }
    }

    show(message, type = 'info', duration = 5000, persistent = false) {
        const notification = this.createNotification(message, type, duration, persistent);
        this.container.appendChild(notification);
        
        // Store persistent notifications
        if (persistent) {
            this.storeNotification({ message, type, timestamp: Date.now() });
        }

        // Auto-remove after duration (unless persistent)
        if (duration > 0 && !persistent) {
            setTimeout(() => {
                this.removeNotification(notification);
            }, duration);
        }

        console.log(`📢 Notification: [${type}] ${message}`);
        return notification;
    }

    createNotification(message, type = 'info', duration = 5000, persistent = false) {
        const notification = document.createElement('div');
        notification.className = `notification-toast notification-${type}`;
        
        const colors = {
            success: '#28a745',
            error: '#dc3545', 
            warning: '#ffc107',
            info: '#007bff'
        };
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        notification.style.cssText = `
            background: ${colors[type] || colors.info};
            color: ${type === 'warning' ? '#212529' : 'white'};
            padding: 15px 20px;
            border-radius: 8px;
            font-weight: 600;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            font-family: 'Roboto', sans-serif;
            min-width: 300px;
            max-width: 400px;
            word-wrap: break-word;
            position: relative;
        `;

        notification.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 12px;">
                <i class="fas ${icons[type] || icons.info}" style="font-size: 1.2rem; margin-top: 2px; flex-shrink: 0;"></i>
                <div style="flex: 1;">
                    <div style="font-size: 14px; line-height: 1.4;">${message}</div>
                    ${persistent ? '<div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">Persistent notification</div>' : ''}
                </div>
                <button class="notification-close" style="
                    background: none;
                    border: none;
                    color: ${type === 'warning' ? '#212529' : 'white'};
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 50%;
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0.8;
                    transition: opacity 0.2s ease;
                    flex-shrink: 0;
                " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">
                    <i class="fas fa-times" style="font-size: 12px;"></i>
                </button>
            </div>
        `;

        // Add click to close functionality
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeNotification(notification);
            if (persistent) {
                this.removeStoredNotification(message);
            }
        });

        return notification;
    }

    removeNotification(notification) {
        notification.classList.add('removing');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }

    storeNotification(notification) {
        try {
            let stored = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
            
            // Remove old notifications if at limit
            if (stored.length >= this.MAX_STORED_NOTIFICATIONS) {
                stored = stored.slice(-(this.MAX_STORED_NOTIFICATIONS - 1));
            }
            
            // Add new notification
            stored.push(notification);
            
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stored));
        } catch (error) {
            console.error('Failed to store notification:', error);
        }
    }

    removeStoredNotification(message) {
        try {
            let stored = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
            stored = stored.filter(n => n.message !== message);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stored));
        } catch (error) {
            console.error('Failed to remove stored notification:', error);
        }
    }

    loadStoredNotifications() {
        try {
            const stored = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
            
            // Filter out old notifications (older than 1 hour)
            const oneHour = 60 * 60 * 1000;
            const validNotifications = stored.filter(n => 
                Date.now() - n.timestamp < oneHour
            );
            
            // Update storage with valid notifications only
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(validNotifications));
            
            // Display valid notifications
            validNotifications.forEach(notification => {
                setTimeout(() => {
                    this.show(notification.message, notification.type, 0, true);
                }, 100);
            });
            
            if (validNotifications.length > 0) {
                console.log(`📢 Loaded ${validNotifications.length} persistent notifications`);
            }
        } catch (error) {
            console.error('Failed to load stored notifications:', error);
        }
    }

    clearAll() {
        // Remove all visible notifications
        const notifications = this.container.querySelectorAll('.notification-toast');
        notifications.forEach(notification => {
            this.removeNotification(notification);
        });
        
        // Clear stored notifications
        localStorage.removeItem(this.STORAGE_KEY);
        
        console.log('📢 All notifications cleared');
    }

    // Convenience methods
    success(message, duration = 5000, persistent = false) {
        return this.show(message, 'success', duration, persistent);
    }

    error(message, duration = 8000, persistent = false) {
        return this.show(message, 'error', duration, persistent);
    }

    warning(message, duration = 6000, persistent = false) {
        return this.show(message, 'warning', duration, persistent);
    }

    info(message, duration = 5000, persistent = false) {
        return this.show(message, 'info', duration, persistent);
    }
}

// Global notification functions for compatibility
function showNotification(message, type = 'info', duration = 5000, persistent = false) {
    if (window.notificationManager) {
        return window.notificationManager.show(message, type, duration, persistent);
    } else {
        // Fallback for when notification manager isn't loaded
        console.log(`Notification [${type}]: ${message}`);
    }
}

// Initialize notification manager when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new NotificationManager();
    });
} else {
    new NotificationManager();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationManager;
}
