const API = {
    baseUrl: '/api',

    async login(email, password) {
        const response = await fetch(`${this.baseUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        return response.json();
    },

    async register(userData) {
        const response = await fetch(`${this.baseUrl}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        return response.json();
    },

    async getClasses() {
        const response = await fetch(`${this.baseUrl}/classes`);
        return response.json();
    },

    // Attendance Methods
    async saveBulkAttendance(payload) {
        const response = await fetch(`${this.baseUrl}/attendance/bulk-mark`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return response.json();
    },

    async getAttendanceStats() {
        // In a real app, this would call a specific aggregation endpoint
        // For now, we mock it or fetch raw data if we had a full backend
        return {
            avg: 88,
            atRisk: 5,
            topClass: "Web Development (CS305)"
        };
    }
};
