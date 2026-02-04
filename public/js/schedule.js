/**
 * schedule.js - Schedule page functionality with caching
 */

// Load immediately on script parse (don't wait for DOMContentLoaded)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSchedule);
} else {
    loadSchedule();
}

/**
 * Load and render the schedule - optimized for speed
 */
async function loadSchedule() {
    const container = document.getElementById('scheduleContainer');
    if (!container) return;
    
    try {
        // Show skeleton while loading
        container.innerHTML = getSkeletonHTML();
        
        // Get classes (will use cache if available)
        const classes = await API.getClasses();
        
        if (!classes || classes.length === 0) {
            container.innerHTML = '<p class="text-secondary">No classes found.</p>';
            return;
        }

        // Group by Day
        const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        const grouped = {};
        
        classes.forEach(c => {
            if (!grouped[c.day]) grouped[c.day] = [];
            grouped[c.day].push(c);
        });

        // Sort by time within day
        for (let day in grouped) {
            grouped[day].sort((a, b) => a.time.localeCompare(b.time));
        }

        let html = '';
        let delay = 0;

        daysOrder.forEach(day => {
            if (grouped[day] && grouped[day].length > 0) {
                html += `<div class="day-group" style="animation-delay: ${delay}s">
                        <div class="day-header">${day}</div>`;
                
                grouped[day].forEach(c => {
                    const type = (c.type || 'lecture').toLowerCase();
                    html += `
                        <div class="class-card type-${type}">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                <div class="font-bold" style="font-size: 1.1rem;">${c.name}</div>
                                <span class="type-badge badge-${type}">${c.type || 'Lecture'}</span>
                            </div>
                            <div class="class-meta">
                                <div class="class-meta-item">🕒 ${c.time}</div>
                                <div class="class-meta-item">📍 ${c.room}</div>
                            </div>
                            <div class="text-sm text-secondary" style="margin-top: 8px;">
                                👨‍🏫 ${c.lecturerName} • ${c.code}
                            </div>
                        </div>
                    `;
                });

                html += `</div>`;
                delay += 0.05; // Faster animation
            }
        });

        container.innerHTML = html || '<p class="text-secondary">No classes scheduled.</p>';

        // Update Next Class Widget
        updateNextClassWidget(classes);

    } catch (e) {
        console.error(e);
        container.innerHTML = '<p class="text-error">Failed to load schedule.</p>';
    }
}

/**
 * Update the "Next Up" widget
 */
function updateNextClassWidget(classes) {
    if (!classes || classes.length === 0) return;
    
    const next = classes[0];
    const nextName = document.getElementById('nextClassName');
    const nextTime = document.getElementById('nextClassTime');
    const nextRoom = document.getElementById('nextClassRoom');
    
    if (nextName) nextName.textContent = next.name;
    if (nextTime) nextTime.textContent = next.time;
    if (nextRoom) nextRoom.textContent = next.room;
}

/**
 * Get skeleton loading HTML
 */
function getSkeletonHTML() {
    return `
        <div class="day-group">
            <div class="day-header" style="width: 100px; height: 20px; background: #E5E7EB; border-radius: 4px;"></div>
            <div class="class-card" style="background: #F3F4F6;">
                <div style="width: 200px; height: 24px; background: #E5E7EB; border-radius: 4px; margin-bottom: 12px;"></div>
                <div style="width: 150px; height: 16px; background: #E5E7EB; border-radius: 4px;"></div>
            </div>
            <div class="class-card" style="background: #F3F4F6;">
                <div style="width: 180px; height: 24px; background: #E5E7EB; border-radius: 4px; margin-bottom: 12px;"></div>
                <div style="width: 140px; height: 16px; background: #E5E7EB; border-radius: 4px;"></div>
            </div>
        </div>
    `;
}
