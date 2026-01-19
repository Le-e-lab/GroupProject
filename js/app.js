// App entry point

document.addEventListener('DOMContentLoaded', () => {
    console.log('Paden application started');
    // Default to student view for now
    loadDashboard('student');
});

function switchTab(tab) {
    // Update active class on nav links
    document.querySelectorAll('nav a').forEach(el => el.classList.remove('active'));
    event.target.classList.add('active');

    loadDashboard(tab);
}

function loadDashboard(type) {
    const app = document.getElementById('app');

    if (type === 'student') {
        app.innerHTML = `
            <div class="dashboard-header" style="margin-bottom: 30px;">
                <h1>Find your home away from home 🏠</h1>
                <p class="text-secondary">Browse the best off-campus housing options.</p>
            </div>
            
            <!-- Quick Search -->
            <div class="glass-card" style="padding: 20px; margin-bottom: 40px; display: flex; gap: 10px;">
                <input type="text" placeholder="Where do you want to live?" style="flex: 1; padding: 12px; border: 1px solid var(--border-color); border-radius: 8px;">
                <button class="btn btn-primary">Search</button>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px;">
                <!-- Placeholder for listings -->
                <div class="card">
                    <div style="height: 180px; background: #e5e7eb; border-radius: 8px; margin-bottom: 16px;"></div>
                    <h3 style="margin-bottom: 8px;">Sunny Apartment near Campus</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 16px;">$800/month • 2 Bed • 1 Bath</p>
                    <button class="btn btn-primary" style="width: 100%;">View Details</button>
                </div>
                 <div class="card">
                    <div style="height: 180px; background: #e5e7eb; border-radius: 8px; margin-bottom: 16px;"></div>
                    <h3 style="margin-bottom: 8px;">Modern Studio Downtown</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 16px;">$1200/month • Studio • 1 Bath</p>
                    <button class="btn btn-primary" style="width: 100%;">View Details</button>
                </div>
                 <div class="card">
                    <div style="height: 180px; background: #e5e7eb; border-radius: 8px; margin-bottom: 16px;"></div>
                    <h3 style="margin-bottom: 8px;">Cozy Shared House</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 16px;">$500/month • 4 Bed • 2 Bath</p>
                    <button class="btn btn-primary" style="width: 100%;">View Details</button>
                </div>
            </div>
        `;
    } else if (type === 'landlord') {
        app.innerHTML = `
            <div class="dashboard-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
                <div>
                    <h1>Landlord Dashboard</h1>
                    <p class="text-secondary">Manage your listings and applications.</p>
                </div>
                <button class="btn btn-primary">+ Add New Listing</button>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 40px;">
                <div class="card">
                    <h3 style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 8px;">Active Listings</h3>
                    <p style="font-size: 2rem; font-weight: 700;">3</p>
                </div>
                <div class="card">
                    <h3 style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 8px;">Total Views</h3>
                    <p style="font-size: 2rem; font-weight: 700;">1,240</p>
                </div>
                <div class="card">
                    <h3 style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 8px;">New Applications</h3>
                    <p style="font-size: 2rem; font-weight: 700; color: var(--primary-color);">5</p>
                </div>
            </div>

            <h2>Your Properties</h2>
             <div class="card" style="margin-top: 16px; padding: 0;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead style="background: var(--background-color); border-bottom: 1px solid var(--border-color);">
                        <tr>
                            <th style="padding: 16px; text-align: left;">Property</th>
                            <th style="padding: 16px; text-align: left;">Status</th>
                            <th style="padding: 16px; text-align: left;">Price</th>
                            <th style="padding: 16px; text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="border-bottom: 1px solid var(--border-color);">
                            <td style="padding: 16px; font-weight: 500;">123 College Ave</td>
                            <td style="padding: 16px;"><span style="background: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 4px; font-size: 0.875rem;">Active</span></td>
                            <td style="padding: 16px;">$1,200/mo</td>
                            <td style="padding: 16px; text-align: right;"><button style="border: none; background: none; color: var(--primary-color); cursor: pointer;">Edit</button></td>
                        </tr>
                         <tr>
                            <td style="padding: 16px; font-weight: 500;">456 University Blvd</td>
                            <td style="padding: 16px;"><span style="background: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 4px; font-size: 0.875rem;">Active</span></td>
                            <td style="padding: 16px;">$950/mo</td>
                            <td style="padding: 16px; text-align: right;"><button style="border: none; background: none; color: var(--primary-color); cursor: pointer;">Edit</button></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    }
}
