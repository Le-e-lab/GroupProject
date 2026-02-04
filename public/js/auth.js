/**
 * auth.js - Login page functionality
 */

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('errorMessage');
    const loginBtn = document.getElementById('loginBtn');

    // Toggle password visibility
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function() {
            const type = passwordInput.type === 'password' ? 'text' : 'password';
            passwordInput.type = type;
            this.textContent = type === 'password' ? 'Show' : 'Hide';
        });
    }

    // Handle form submission
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const userId = document.getElementById('userId').value;
            const password = passwordInput.value;

            // Hide any previous error
            if (errorMessage) errorMessage.style.display = 'none';
            
            // Update button state
            loginBtn.textContent = 'Signing in...';
            loginBtn.disabled = true;

            try {
                const result = await API.login(userId, password);
                
                if (result.user) {
                    sessionStorage.setItem('upath_user', JSON.stringify(result.user));
                    
                    // Redirect based on role
                    const redirectUrl = result.user.role === 'lecturer' 
                        ? '../lecturer_dashboard.html' 
                        : '../dashboard.html';
                    
                    loginBtn.textContent = 'Success! Redirecting...';
                    window.location.href = redirectUrl;
                } else {
                    errorMessage.textContent = result.message || 'Invalid credentials. Please try again.';
                    errorMessage.style.display = 'block';
                    loginBtn.textContent = 'Sign In';
                    loginBtn.disabled = false;
                }
            } catch (error) {
                console.error(error);
                errorMessage.textContent = 'Unable to connect to server. Please try again.';
                errorMessage.style.display = 'block';
                loginBtn.textContent = 'Sign In';
                loginBtn.disabled = false;
            }
        });
    }
});
