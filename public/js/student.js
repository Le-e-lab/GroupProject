/**
 * student.js - Student Dashboard functionality
 */

document.addEventListener('DOMContentLoaded', function() {
    initStudentDashboard();
});

/**
 * Initialize student dashboard
 */
function initStudentDashboard() {
    // Load user data
    const userStr = sessionStorage.getItem('upath_user');
    if (userStr) {
        const user = JSON.parse(userStr);
        
        // Update welcome message
        const welcome = document.querySelector('.student-welcome h1');
        if (welcome && user.fullName) {
            const firstName = user.fullName.split(' ')[0];
            welcome.textContent = `Welcome, ${firstName}!`;
        }

        // Update avatar
        const avatar = document.getElementById('userAvatar');
        if (avatar && user.fullName) {
            avatar.textContent = user.fullName.split(' ')
                .map(n => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase();
        }
    }

    // Load classes
    loadTodayClasses();
    
    // Setup attendance code inputs
    setupAttendanceInputs();
}

/**
 * Load today's classes
 */
async function loadTodayClasses() {
    try {
        const classes = await API.getClasses();
        const classList = document.getElementById('classList');
        
        if (!classes || classes.length === 0) {
            classList.innerHTML = '<p style="color: var(--student-text-muted); text-align: center; padding: 20px;">No classes today</p>';
            return;
        }

        // Get today's classes
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const today = days[new Date().getDay()];
        const todayClasses = classes.filter(c => c.day === today);

        if (todayClasses.length === 0) {
            // Show some classes anyway for demo
            renderClasses(classes.slice(0, 3));
        } else {
            renderClasses(todayClasses);
        }

        // Update attendance dropdown
        updateAttendanceDropdown(classes);

    } catch (e) {
        console.error('Error loading classes:', e);
    }
}

/**
 * Render class items
 */
function renderClasses(classes) {
    const classList = document.getElementById('classList');
    
    let html = '';
    classes.forEach((c, i) => {
        const isNew = i === classes.length - 1;
        html += `
            <div class="class-item">
                <div class="class-item-header">
                    <span class="class-item-name">${c.name}</span>
                    <span class="class-item-date">📅 ${formatDate()}</span>
                    ${isNew ? '<span class="class-new-badge">New</span>' : ''}
                </div>
                <div class="class-item-professor">
                    <span class="professor-avatar">👨‍🏫</span>
                    ${c.lecturerName}
                </div>
                <p class="class-item-description">
                    ${c.code} • ${c.room} • ${c.time}
                </p>
            </div>
        `;
    });

    classList.innerHTML = html;
}

/**
 * Update attendance dropdown
 */
function updateAttendanceDropdown(classes) {
    const select = document.getElementById('attendanceClass');
    if (!select) return;

    select.innerHTML = classes.map(c => 
        `<option value="${c.id}">${c.name}</option>`
    ).join('');
}

/**
 * Setup attendance code inputs - auto-focus next
 */
function setupAttendanceInputs() {
    const inputs = document.querySelectorAll('.attendance-code-input');
    
    inputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            if (e.target.value.length === 1 && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                inputs[index - 1].focus();
            }
        });
    });
}

/**
 * Mark present
 */
function markPresent() {
    const inputs = document.querySelectorAll('.attendance-code-input');
    const code = Array.from(inputs).map(i => i.value).join('');
    
    if (code.length < 6) {
        alert('Please enter the full 6-digit code');
        return;
    }

    const btn = document.querySelector('.attendance-present-btn');
    btn.textContent = 'Marking...';
    btn.disabled = true;

    setTimeout(() => {
        btn.textContent = '✓ Marked Present!';
        btn.style.background = '#4CAF50';
        
        setTimeout(() => {
            btn.textContent = 'Present';
            btn.style.background = '';
            btn.disabled = false;
            inputs.forEach(i => i.value = '');
        }, 2000);
    }, 1000);
}

/**
 * Logout
 */
function logout() {
    sessionStorage.removeItem('upath_user');
    window.location.href = 'pages/auth.html';
}

/**
 * Format today's date
 */
function formatDate() {
    const d = new Date();
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear().toString().slice(-2)}`;
}
