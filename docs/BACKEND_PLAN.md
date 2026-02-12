# Backend & System Architecture Plan

## 1. Database Recommendation
**Current Status**: using JSON files (fragile, not scalable).
**Recommendation**: **SQLite** (for now) -> **PostgreSQL** (production).

### Why SQLite?
- **Zero Setup**: No need to install a separate database server.
- **SQL Compatible**: Allows you to write real SQL queries (preparation for Postgres).
- **Single File**: The database is just a file (`database.sqlite`), easy to backup/move.
- **Perfect for Dev**: ideal for this stage of "GroupProject".

### Migration Plan
1. Install `sqlite3` and `sequelize` (ORM).
2. Define Models (`User`, `Class`, `Attendance`).
3. Create a script to import existing JSON data into SQLite.
4. Update API routes to query database instead of reading JSON.

## 2. Bluetooth Proximity Plan
**Challenge**: Web browsers cannot easily act as Bluetooth Beacons. They can only *connect* to devices.
**Solution**: **"Simulated" Proximity via TOTP (Time-based One-Time Password)**.

Since true Bluetooth beacons require native mobile apps, we will simulate the security:
1. **Lecturer Device**: Generates a fast-changing code (every 30s) derived from a secret + timestamp.
2. **Student Device**:
   - MUST scan the QR code to get the current "token".
   - The token contains a timestamp.
   - Server verifies if the token was generated < 30 seconds ago.
   - This validates the student is **physically seeing** the screen right now.
3. **Bluetooth Add-on**: If you strictly need Bluetooth, we can use the **Web Bluetooth API** to scan for a specific BLE device (like a cheap ESP32 or the Lecturer's laptop if it runs a BLE server script), but this is advanced and browser-support varies (Chrome only).

**Recommendation**: Stick to **Rotating QR Codes (TOTP)** for now. It's the industry standard for "proof of presence" without hardware beacons.

## 3. Camera / QR Scanning
**Standard**: `html5-qrcode` library.
- Works in browser.
- requesting camera permissions.
- Scans QR codes and returns string content.

## 4. Full Stack Roadmap (One by One)

### Phase 1: Database (Next Step)
- [ ] Install SQLite & Sequelize.
- [ ] Migrate Users & Classes to DB.
- [ ] Verify Login & Schedule with DB.

### Phase 2: Attendance Logic
- [ ] Create Attendance Table.
- [ ] Update `/mark` endpoint to save to DB.
- [ ] Update Dashboard stats to query DB.

### Phase 3: QR & Camera
- [ ] Add "Scan QR" button to Student Dashboard.
- [ ] Implement Camera view overlay.
- [ ] Handle QR scan -> API call.

### Phase 4: Security (Proximity)
- [ ] Implement Rotating QR logic on Lecturer Dashboard.
- [ ] Validate codes on backend.
