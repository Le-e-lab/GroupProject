/**
 * dashboard.js - Student Dashboard functionality
 */

document.addEventListener('DOMContentLoaded', function() {
    // Dynamic greeting based on time
    const hour = new Date().getHours();
    let greeting = 'Good morning';
    if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
    else if (hour >= 17) greeting = 'Good evening';
    
    const welcomeHeader = document.getElementById('welcomeHeader');
    if (welcomeHeader) {
        welcomeHeader.textContent = `${greeting}! 👋`;
    }
});

/**
 * Open QR scanner modal
 */
function openQRModal() {
    const modal = document.getElementById('qrModal');
    if (modal) modal.style.display = 'flex';
}

/**
 * Close QR scanner modal
 */
function closeQRModal() {
    const modal = document.getElementById('qrModal');
    if (modal) modal.style.display = 'none';
}

/**
 * Simulate QR code scan
 */
async function simulateScan() {
    const btn = document.querySelector('#qrModal .btn-primary');
    if (!btn) return;
    
    btn.textContent = 'Scanning...';
    btn.disabled = true;
    
    setTimeout(() => {
        closeQRModal();
        btn.textContent = 'Simulate Scan';
        btn.disabled = false;
        
        // Add success notification to activity list
        const list = document.getElementById('activityList');
        if (list) {
            const newItem = document.createElement('div');
            newItem.className = 'activity-item';
            newItem.innerHTML = `
                <div class="activity-icon success">✓</div>
                <div style="flex: 1;">
                    <div class="font-bold" style="font-size: 0.9rem;">Attendance Marked</div>
                    <div class="text-secondary text-sm">Database Systems</div>
                    <div class="text-secondary" style="font-size: 0.75rem; margin-top: 4px;">Just now</div>
                </div>
            `;
            list.insertBefore(newItem, list.firstChild);
        }
        
        // Show success toast
        alert('✅ Attendance marked successfully!');
    }, 1500);
}
