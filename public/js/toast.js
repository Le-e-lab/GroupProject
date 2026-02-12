/**
 * Toast Notification System
 * Usage: 
 *   Toast.success("Message");
 *   Toast.error("Message");
 *   Toast.info("Message");
 *   Toast.warning("Message");
 */

const Toast = {
    container: null,

    // Initialize container
    init() {
        if (!document.querySelector('.toast-container')) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        } else {
            this.container = document.querySelector('.toast-container');
        }
    },

    /**
     * Show a toast message
     * @param {string} message 
     * @param {'success'|'error'|'info'|'warning'} type 
     * @param {number} duration (ms)
     */
    show(message, type = 'info', duration = 4000) {
        if (!this.container) this.init();

        // Create elements
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // Icons mapping
        const icons = {
            success: '✓',
            error: '✕',
            info: 'ℹ',
            warning: '⚠'
        };

        toast.innerHTML = `
            <div class="toast-icon">${icons[type]}</div>
            <div class="toast-message">${message}</div>
            <div class="toast-progress" style="animation-duration: ${duration}ms"></div>
        `;

        // Click to dismiss
        toast.onclick = () => this.dismiss(toast);

        // Auto dismiss
        const timeout = setTimeout(() => {
            this.dismiss(toast);
        }, duration);

        // Pause on hover (optional enhancement - prevents auto dismiss while hovering)
        toast.onmouseenter = () => {
            const progress = toast.querySelector('.toast-progress');
            if (progress) progress.style.animationPlayState = 'paused';
            clearTimeout(timeout);
        };
        
        toast.onmouseleave = () => {
            const progress = toast.querySelector('.toast-progress');
            if (progress) progress.style.animationPlayState = 'running';
            // Restart timer logic would be complex here, so simpler to just let it dismiss or stay
            // For simplicity, we'll just re-set a short timeout to dismiss
            setTimeout(() => this.dismiss(toast), 1000); 
        };

        this.container.appendChild(toast);
    },

    dismiss(toast) {
        toast.classList.add('hiding');
        toast.addEventListener('animationend', () => {
            if (toast.parentElement) toast.remove();
        });
    },

    // Convenience methods
    success(msg) { this.show(msg, 'success'); },
    error(msg) { this.show(msg, 'error'); },
    info(msg) { this.show(msg, 'info'); },
    warning(msg) { this.show(msg, 'warning'); }
};

// Auto-init on load
document.addEventListener('DOMContentLoaded', () => Toast.init());

// Export for module usage if needed
if (typeof module !== 'undefined') module.exports = Toast;
