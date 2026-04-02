# Feature Implementation Plan

## Scope

- Stabilize AI assistant behavior and error handling.
- Complete responsive behavior across dashboard tabs and page tab controls.
- Finish i18n coverage and profile language flow.
- Keep admin dashboard tabs functionally consistent.
- Reduce project warnings, with focus on markdown lint issues.

## Current Status

- AI route and frontend widget are integrated in student, lecturer, and admin pages.
- AI scope checks and collaborative mode are active.
- Language preference endpoints exist and profile pages can save preferences.
- Admin smoke tests run successfully in local checks.

## Work Items

### 1. AI Reliability

- Keep backend-only model calls.
- Return structured fallback responses when provider quota or model issues occur.
- Preserve debug diagnostics for admin users.

### 2. Responsive Tabs

- Ensure tab containers can scroll horizontally on small screens.
- Keep tab controls readable and touch-friendly on mobile.
- Verify admin, student, and lecturer dashboard tab layouts.

### 3. Internationalization

- Use `en`, `fr`, and `pt` consistently across nav and page titles.
- Keep profile language selector as source of truth.
- Apply language on load via existing i18n helper.

### 4. Admin Consistency

- Verify all admin panels can be opened from the sidebar.
- Confirm each panel loads data or cleanly handles empty states.
- Keep role restrictions intact for admin-only actions.

### 5. Warning Reduction

- Resolve markdown lint issues in planning documents.
- Re-run diagnostics and keep only intentional warnings.

## Verification Checklist

- `npm start` runs without runtime syntax failures.
- AI widget opens, closes, and submits with Enter key.
- AI provider failures no longer surface as hard 5xx resource errors in browser flow.
- Student, lecturer, and admin tab pages remain usable on mobile widths.
- Markdown diagnostics are reduced from previous baseline.

## Notes

- Provider-side model quotas can still limit answer generation.
- In those cases, the app should show a friendly fallback answer and retry guidance.
