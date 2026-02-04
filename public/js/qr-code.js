/**
 * qr-code.js - QR Code page functionality
 */

document.addEventListener('DOMContentLoaded', function() {
    initQRPage();
});

/**
 * Initialize QR code page
 */
function initQRPage() {
    // Get URL params
    const urlParams = new URLSearchParams(window.location.search);
    const name = urlParams.get('name') || "Unknown Class";
    const code = urlParams.get('code') || "---";
    const id = urlParams.get('id') || "0";

    // Update UI
    const className = document.getElementById('className');
    const classCode = document.getElementById('classCode');
    
    if (className) className.textContent = name;
    if (classCode) classCode.textContent = code;

    // Generate QR Data
    const qrData = JSON.stringify({
        app: "upath",
        action: "attendance",
        classId: id,
        date: new Date().toISOString().split('T')[0],
        timestamp: Date.now()
    });

    // Set QR Image Source (Using qrserver API)
    const size = "400x400";
    const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}&data=${encodeURIComponent(qrData)}`;
    const qrImage = document.getElementById('qrImage');
    if (qrImage) qrImage.src = apiUrl;

    // Start countdown timer
    startTimer();
}

/**
 * Start the countdown timer
 */
function startTimer() {
    let time = 15 * 60; // 15 minutes
    const timerElement = document.getElementById('timer');
    
    if (!timerElement) return;
    
    const interval = setInterval(() => {
        time--;
        if (time <= 0) {
            clearInterval(interval);
            timerElement.textContent = '0:00';
            timerElement.style.color = 'var(--color-error)';
            return;
        }
        
        const mins = Math.floor(time / 60);
        const secs = time % 60;
        timerElement.textContent = `${mins}:${secs < 10 ? '0'+secs : secs}`;
    }, 1000);
}
