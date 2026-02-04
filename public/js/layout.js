/**
 * layout.js
 * Handles dynamic sidebar injection and user navigation state.
 */

document.addEventListener('DOMContentLoaded', () => {
    const userStr = sessionStorage.getItem('upath_user');
    if (!userStr) {
        // Redirect to login if not authenticated (extra safety)
        if (!window.location.pathname.includes('auth.html') && !window.location.pathname.includes('login.html')) {
            window.location.href = '/pages/auth.html';
            return;
        }
    }

    const user = JSON.parse(userStr || '{}');
    const role = user.role || 'student';
    
    // Determine Menu Items based on Role
    let menuItems = [];

    if (role === 'lecturer') {
        menuItems = [
            { name: 'Dashboard', icon: '🏠', link: '/lecturer_dashboard.html' },
            { name: 'Schedule', icon: '📅', link: '/pages/lecturer_schedule.html' },
            { name: 'My Classes', icon: '👥', link: '/pages/my_classes.html' },
            { name: 'Manual Entry', icon: '📝', link: '/pages/manual_attendance.html' },
            { name: 'Reports', icon: '📊', link: '/pages/lecturer_reports.html' }
        ];
    } else {
        menuItems = [
            { name: 'Dashboard', icon: '🏠', link: '/dashboard.html' },
            { name: 'Schedule', icon: '📅', link: '/pages/schedule.html' },
            { name: 'Reports', icon: '📊', link: '/pages/reports.html' },
            { name: 'Navigation', icon: '🧭', link: '/pages/navigation.html' },
            { name: 'Profile', icon: '👤', link: '/pages/profile.html' }
        ];
    }

    // Build Sidebar HTML
    const currentPath = window.location.pathname;
    const navLinksHtml = menuItems.map(item => {
        // Simple active check
        const isActive = currentPath === item.link; // Exact match or improve logic if needed
        return `
            <a href="${item.link}" class="nav-item ${isActive ? 'active' : ''}">
                <span class="nav-icon">${item.icon}</span> ${item.name}
            </a>
        `;
    }).join('');

    const userInitials = user.fullName ? user.fullName.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase() : '--';
    const userName = user.fullName ? user.fullName.split(' ')[0] : 'User';
    const userIdDisplay = user.idNumber ? `ID: ${user.idNumber}` : '';

    const sidebarHtml = `
        <aside class="sidebar" id="globalSidebar">
            <div style="margin-bottom: 40px; display: flex; justify-content: space-between; align-items: center;">
                <a href="#" class="text-primary font-bold" style="font-size: var(--text-xl);">📍 UPath</a>
                <button onclick="toggleMobileMenu()" class="mobile-close-btn" style="border:none; background:none; font-size: 1.2rem; cursor: pointer; display: none;">✕</button>
            </div>
            
            <nav style="flex: 1;">
                ${navLinksHtml}
            </nav>

            <div style="border-top: 1px solid var(--color-gray-200); padding-top: 20px;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                    <div style="width: 40px; height: 40px; background: var(--color-primary-light); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--color-primary); font-weight: bold;">
                        <span>${userInitials}</span>
                    </div>
                    <div>
                        <div class="font-bold" style="font-size: var(--text-sm); color: var(--color-black);">${userName}</div>
                        <div class="text-secondary" style="font-size: var(--text-xs);">${userIdDisplay}</div>
                    </div>
                </div>
                <button onclick="logout()" class="btn btn-outline btn-full" style="font-size: var(--text-sm);">Log Out</button>
            </div>
        </aside>
        
        <!-- Mobile Toggle Button (Injected into body if not present) -->
        <button id="mobileMenuBtn" onclick="toggleMobileMenu()" style="position: fixed; top: 15px; right: 15px; z-index: 100; background: white; border: 1px solid #ddd; padding: 8px; border-radius: 4px; display: none;">
            ☰
        </button>
        <style>
            @media(max-width: 768px) { 
                #mobileMenuBtn { display: block !important; } 
                .mobile-close-btn { display: block !important; }
            }
        </style>
    `;

    // Inject Sidebar
    const container = document.getElementById('sidebar-container');
    if (container) {
        container.innerHTML = sidebarHtml;
        initNavigation(); // Initialize SPA listeners
    } else {
        console.warn('No #sidebar-container in DOM. Manual injection required?');
    }
});

function toggleMobileMenu() {
    const sidebar = document.getElementById('globalSidebar');
    if (sidebar) sidebar.classList.toggle('mobile-open');
}

function logout() {
    sessionStorage.removeItem('upath_user');
    window.location.href = '/pages/auth.html';
}

/* =========================================
   SPA Navigation Logic
   ========================================= */
function initNavigation() {
    const links = document.querySelectorAll('.nav-item');
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); // Stop full reload
            const url = link.getAttribute('href');
            navigateTo(url);
        });
    });

    // Handle Back/Forward Browser Buttons
    window.addEventListener('popstate', () => {
        loadPageContent(window.location.pathname);
    });
}

function navigateTo(url) {
    window.history.pushState(null, '', url);
    loadPageContent(url);
    updateActiveLink(url);
}

function updateActiveLink(url) {
    document.querySelectorAll('.nav-item').forEach(link => {
        if (link.getAttribute('href') === url) {
            link.classList.add('active');
            link.classList.remove('text-secondary'); // Ensure styling resets if needed
        } else {
            link.classList.remove('active');
        }
    });
}

async function loadPageContent(url) {
    const mainContent = document.querySelector('.main-content');
    mainContent.style.opacity = '0.5'; // Loading feedback

    try {
        const response = await fetch(url);
        const text = await response.text();
        
        // Parse HTML to extract .main-content
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const newContent = doc.querySelector('.main-content');
        
        if (newContent) {
            mainContent.innerHTML = newContent.innerHTML;
            
            // Re-execute scripts
            const scripts = mainContent.querySelectorAll('script');
            scripts.forEach(oldScript => {
                const newScript = document.createElement('script');
                Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                oldScript.parentNode.replaceChild(newScript, oldScript);
            });

            // Re-initialize any page specific things if needed (e.g. charts)
        } else {
            // Fallback if specific container not found (e.g. auth page)
            window.location.href = url;
        }

    } catch (err) {
        console.error('Navigation Error:', err);
        mainContent.innerHTML = '<h2>Error loading content. Please refresh.</h2>';
    } finally {
        mainContent.style.opacity = '1';
        // Close mobile menu on nav
        const sidebar = document.getElementById('globalSidebar');
        if (sidebar) sidebar.classList.remove('mobile-open');
    }
}
