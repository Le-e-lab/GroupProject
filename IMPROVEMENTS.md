# Code Improvements & Optimization Opportunities

Generated: April 2, 2026  
Status: Post v2.1 Stability Update

## Summary

The UPath application has reached feature parity for core production use. This document outlines technical debt reduction and code quality improvements to enhance maintainability, performance, and testability.

---

## Priority 1: Critical Performance (Next Sprint)

### 1.1 Backend Route Refactoring
**File**: `server/routes/attendance.js` (1,298 lines)  
**Issue**: Monolithic route file combining session management, validation, analytics, and exports.  
**Recommendation**: Split into logical modules:
```
server/routes/attendance/
  ├── sessions.js        (checkin, checkout, close handlers)
  ├── validation.js      (code validate, QR validate)
  ├── analytics.js       (stats, charts, reports)
  └── exports.js         (CSV, PDF exports)
```
**Benefit**: Easier testing, clearer separation of concerns, 25% faster navigation in IDE.

### 1.2 Frontend Bundle Optimization
**Files**: 
- `public/pages/student/map.html` (1,459 lines)
- `public/dashboard.html` (1,403 lines)

**Issue**: Inline JavaScript with event handlers mixed in HTML.  
**Recommendation**: Extract into separate `.js` files per page:
```
public/js/pages/
  ├── map.js
  ├── dashboard.js
  ├── qr-code.js
  └── enter-code.js
```
**Benefit**: Reuse utilities, cache busting, tree-shaking, reduce HTML payload by 40%.

---

## Priority 2: Code Quality (Ongoing)

### 2.1 Centralize API Methods in api.js
**Issue**: Some routes have duplicate fetch logic in different pages (e.g., `fetchUsers`, `fetchClasses`).  
**Action**: Ensure all HTTP requests go through `API.*` wrapper for:
- Cache control
- Error handling consistency
- Audit logging (optional)
- Retry policies (exponential backoff)

**Example**:
```javascript
// Centralized retry logic
API.retry = async (fn, maxAttempts = 3) => {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i < maxAttempts - 1) await sleep(200 * (i + 1));
    }
  }
  throw err;
};
```

### 2.2 Add Input Validation Layer
**Current State**: Individual routes validate inputs manually.  
**Recommendation**: Adopt `joi` or `zod` for schema validation:
```javascript
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

router.post('/login', (req, res) => {
  const { success, data, error } = loginSchema.safeParse(req.body);
  if (!success) return res.status(400).json({ error });
  // ... proceed
});
```
**Benefit**: Automatic OpenAPI docs generation, reduced code duplication.

### 2.3 Extract Service Layer
**Current**: Business logic mixed in route handlers.  
**Recommendation**:
```
server/services/
  ├── attendance.service.js (checkin, checkout logic)
  ├── class.service.js      (class resolution)
  ├── user.service.js       (user operations)
  └── notification.service.js
```
**Benefit**: Testable, reusable, easier mocking.

---

## Priority 3: Testing & Reliability (Monthly)

### 3.1 Unit Tests for Critical Paths
**Files to test**:
- Attendance lifecycle (checkin → checkout → complete)
- Class ownership resolution
- Student cohort validation
- Device trust checks

**Framework**: Jest + Supertest  
**Target**: 60% coverage minimum for critical paths
```bash
npm test -- --coverage --collectCoverageFrom="server/**/*.js"
```

### 3.2 Integration Tests
**Scenarios**:
1. Student can check into own class, not foreign class
2. Lecturer can only open/close own class sessions
3. Admin can override attendance
4. Analytics exclude incomplete attendance
5. QR code timeout and refresh

**Framework**: Playwright or Cypress  
**Duration**: 15–30 min CI/CD run

### 3.3 Load Testing
**Tool**: K6 or Artillery  
**Targets**:
- 100 concurrent users marking attendance
- Lecturer opening check-in for 50 classes simultaneously
- Admin bulk user import

---

## Priority 4: DevOps & Deployment (Quarterly)

### 4.1 Containerization
**Deliverables**:
- `Dockerfile` for Node.js + SQLite
- `docker-compose.yml` for dev/test environments
- `.dockerignore` for clean builds

**Test locally**:
```bash
docker-compose up
curl http://localhost:3000
```

### 4.2 Database Migrations at Scale
**Current**: Auto-sync via Sequelize.  
**Next**: Sequelize migrations for:
- Schema versioning
- Zero-downtime deployments
- Easy rollback

```bash
npm run migrate:up
npm run migrate:down
npm run migrate:status
```

### 4.3 CI/CD Pipeline
**GitHub Actions workflow**:
1. ESLint + Prettier (code style)
2. Jest unit tests
3. Smoke tests (auth, attendance, admin flows)
4. OWASP dependency check
5. Deploy to staging on `main` merge

---

## Priority 5: Security & Compliance (Ongoing)

### 5.1 Audit Logging
**Currently Missing**: No persistent audit trail for:
- Admin deletions/edits
- Role changes
- Timetable uploads
- AI prompt scopes

**Solution**: Add `AuditLog` Sequelize model:
```javascript
const audit = {
  timestamp: Date.now(),
  actor: userId,
  action: 'DELETE_USER',
  targetId: deletedUserId,
  changes: { role: 'student', deleted: true },
  ipAddress: req.ip
};
```

### 5.2 Rate Limiting Enhancements
**Current**: Login + validation limited.  
**Add limits for**:
- API endpoint per user per minute
- Notification sends per class per hour
- AI assistant per user per day (prompt cost model)

### 5.3 Data Privacy
- [ ] Add GDPR "right to deletion" workflow
- [ ] Mask PII in logs
- [ ] Encryption at rest for sensitive device + identity data
- [ ] Session timeout enforcement on mobile

---

## Priority 6: Analytics & Observability (Monthly)

### 6.1 Structured Logging
**Replace**: `console.log()` in production.  
**Use**: Winston or Pino with JSON output:
```javascript
logger.info('Attendance check-in', {
  userId: '240102',
  classId: 'NCSC312-Wednesday-11:00',
  duration_ms: 450,
  device_trusted: true
});
```
**Benefit**: Searchable logs in ELK/Datadog, metrics extraction.

### 6.2 Performance Monitoring
- Database query timing
- API endpoint response times
- Frontend page load metrics (Lighthouse)
- Memory usage trends

**Tool**: APM tools (New Relic, Datadog, or open-source Prometheus).

### 6.3 User Engagement Analytics
- Time-on-page per role
- Feature adoption (QR vs code entry)
- Failure rates (failed checkins, errors)
- Device type distribution

---

## Priority 7: Accessibility (Quarterly)

### 7.1 Accessibility Audit
**Run Lighthouse A11y checks**:
```bash
npm install -g lighthouse
lighthouse http://localhost:3000/public/dashboard.html --view
```
**Target**: 90+ A11y score.

### 7.2 WCAG 2.1 Level AA Compliance
- [ ] Keyboard navigation (no mouse-only flows)
- [ ] Color contrast (4.5:1 for text)
- [ ] Screen reader support (ARIA labels)
- [ ] Focus visible, logical tab order
- [ ] Form labels and error messages

---

## Quick Wins (1–2 hour fixes)

1. **Sort navigation menus alphabetically** in admin sidebar
2. **Add loading spinners** to slow operations (file uploads, timetable parsing)
3. **Display remaining QR session time** on page title for tabs outside browser focus
4. **Deduplicate studentRep filter** in manage-students (currently duplicate in two places)
5. **Cache timetable data client-side** (Service Worker + IndexedDB) for offline fallback
6. **Add favicon** (currently missing, causes 404 on every page load)
7. **Minify CSS/JS in production** (gzip, brotli compression)
8. **Add breadcrumb navigation** to admin dashboard for clarity
9. **Extract shared notification template** from qr_code.html and manual_attendance.html
10. **Add "no results" placeholder icons** in empty tables/lists

---

## Metrics to Track

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Bundle Size (gzip) | ~400 KB | <300 KB | Q2 2026 |
| First Contentful Paint | ~1.2s | <0.8s | Q2 2026 |
| Lighthouse Score | ~80 | >90 | Q2 2026 |
| Test Coverage | ~15% | >60% | Q3 2026 |
| Accessibility Score | ~75 | >90 | Q3 2026 |
| Mean Time to Deploy | ~10 min | <3 min | Q2 2026 |
| MTBF (incidents) | ~7 days | >30 days | Q4 2026 |

---

## Recommended Reading

- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [12 Factor App](https://12factor.net/)
- [SRE Handbook](https://sre.google/books/)

---

*This document is living and evolves with each sprint. Last updated: Apr 2026.*
