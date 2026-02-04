/**
 * lecturer.js - Lecturer pages functionality
 */

document.addEventListener('DOMContentLoaded', function() {
    // Dynamic greeting
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
 * Open QR Code page
 */
function openQR(id, name, code) {
    window.open(`/pages/qr_code.html?id=${id}&name=${encodeURIComponent(name)}&code=${code}`, '_blank');
}

/**
 * Load lecturer schedule
 */
async function loadLecturerSchedule() {
    try {
        const classes = await API.getClasses();
        const grid = document.getElementById('scheduleGrid');
        if (!grid) return;
        
        // Group by Day
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        const grouped = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] };
        
        // Filter for lecturer's classes
        const myClasses = classes.filter(c => 
            c.lecturerId === 'L1' || 
            c.lecturerName.includes('Moyo') || 
            c.lecturerName.includes('Chiwenga')
        );
        
        myClasses.forEach(c => {
            if (grouped[c.day]) grouped[c.day].push(c);
        });

        let html = '';
        days.forEach(day => {
            html += `<div class="day-column">
                <div class="day-title">${day}</div>`;
            
            if (grouped[day].length === 0) {
                html += `<div class="empty-state">No classes</div>`;
            } else {
                grouped[day].sort((a, b) => a.time.localeCompare(b.time));
                grouped[day].forEach(c => {
                    html += `
                        <div class="lecturer-class-card" onclick="openQR('${c.id}', '${c.name}', '${c.code}')">
                            <span class="time-badge">${c.time}</span>
                            <div class="font-bold" style="font-size: 0.9rem;">${c.name}</div>
                            <div class="text-xs text-secondary">${c.code} • ${c.room}</div>
                        </div>
                    `;
                });
            }
            html += `</div>`;
        });
        
        grid.innerHTML = html;
    } catch (e) {
        console.error(e);
        const grid = document.getElementById('scheduleGrid');
        if (grid) grid.innerHTML = '<p class="text-error">Failed to load schedule.</p>';
    }
}

/**
 * Load lecturer's classes list
 */
async function loadMyClasses() {
    try {
        const classes = await API.getClasses();
        const container = document.getElementById('classList');
        if (!container) return;
        
        if (!classes || classes.length === 0) {
            container.innerHTML = '<div class="card text-center text-secondary" style="padding: 40px;">No classes assigned.</div>';
            return;
        }
        
        let html = '';
        classes.forEach(c => {
            html += `
                <div class="my-class-card">
                    <div class="class-info">
                        <div class="class-info-name">${c.name}</div>
                        <span class="class-info-code">${c.code}</span>
                        <div class="class-info-meta">
                            <div class="class-info-meta-item">📍 ${c.room}</div>
                            <div class="class-info-meta-item">🕒 ${c.day} ${c.time}</div>
                            <div class="class-info-meta-item">👥 45 students</div>
                        </div>
                    </div>
                    <a href="/pages/qr_code.html?id=${c.id}&name=${encodeURIComponent(c.name)}&code=${c.code}" target="_blank" class="show-qr-btn">
                        🔳 Show QR Code
                    </a>
                </div>
            `;
        });
        
        container.innerHTML = html;
    } catch (e) {
        console.error(e);
        const container = document.getElementById('classList');
        if (container) container.innerHTML = '<p class="text-error">Failed to load classes.</p>';
    }
}
