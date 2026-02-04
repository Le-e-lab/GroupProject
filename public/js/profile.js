/**
 * profile.js - Profile page functionality
 */

document.addEventListener('DOMContentLoaded', function() {
    loadProfileData();
});

/**
 * Load user profile data
 */
function loadProfileData() {
    const userStr = sessionStorage.getItem('upath_user');
    if (!userStr) return;
    
    const user = JSON.parse(userStr);
    
    // Update profile display
    const profileName = document.getElementById('profileName');
    const inputName = document.getElementById('inputName');
    const inputId = document.getElementById('inputId');
    const inputEmail = document.getElementById('inputEmail');
    const profileInitials = document.getElementById('profileInitials');
    const profileRole = document.getElementById('profileRole');
    
    if (profileName) profileName.textContent = user.fullName || 'User';
    if (inputName) inputName.value = user.fullName || '';
    if (inputId) inputId.value = user.idNumber || '';
    if (inputEmail) inputEmail.value = user.email || 'student@upath.edu';
    
    if (profileInitials && user.fullName) {
        profileInitials.textContent = user.fullName.split(' ')
            .map(n => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();
    }
    
    if (profileRole) {
        profileRole.textContent = user.role === 'lecturer' ? 'Lecturer' : 'Student';
    }
}

/**
 * Save profile changes
 */
function saveProfile() {
    const btn = document.getElementById('saveBtn');
    if (!btn) return;
    
    btn.textContent = 'Saving...';
    btn.disabled = true;
    
    setTimeout(() => {
        btn.textContent = '✓ Saved!';
        btn.style.background = 'var(--color-success)';
        setTimeout(() => {
            btn.textContent = 'Save Changes';
            btn.style.background = '';
            btn.disabled = false;
        }, 1500);
    }, 800);
}
