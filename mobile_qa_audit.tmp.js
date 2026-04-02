const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const pages = [
    '/dashboard.html',
    '/lecturer_dashboard.html',
    '/pages/admin/dashboard.html',
    '/pages/student/schedule.html',
    '/pages/student/reports.html',
    '/pages/student/map.html',
    '/pages/lecturer/my_classes.html',
    '/pages/lecturer/lecturer_schedule.html',
    '/pages/lecturer/lecturer_reports.html'
  ];
  const vps = [
    { w: 320, h: 568, label: '320x568' },
    { w: 375, h: 667, label: '375x667' },
    { w: 390, h: 844, label: '390x844' },
    { w: 414, h: 896, label: '414x896' },
    { w: 768, h: 1024, label: '768x1024' }
  ];

  const browser = await chromium.launch({ headless: true });
  const out = [];

  for (const p of pages) {
    for (const vp of vps) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
      const page = await ctx.newPage();
      const url = 'http://localhost:3000' + p;
      let navErr = null;
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(800);
      } catch (e) {
        navErr = String(e && e.message ? e.message : e);
      }

      const data = { page: p, breakpoint: vp.label, url, navError: navErr };
      if (!navErr) {
        data.hScroll = await page.evaluate(() => {
          const el = document.scrollingElement || document.documentElement;
          return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, has: el.scrollWidth > el.clientWidth + 1 };
        });

        data.wideNodes = await page.evaluate(() => {
          const vw = window.innerWidth;
          const bad = [];
          document.querySelectorAll('*').forEach((el) => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            if (r.width > vw + 1 && cs.position !== 'fixed') {
              bad.push({
                tag: el.tagName.toLowerCase(),
                id: el.id || null,
                cls: (el.className || '').toString().slice(0, 120),
                w: Math.round(r.width),
                left: Math.round(r.left),
                right: Math.round(r.right),
                overflowX: cs.overflowX,
                whiteSpace: cs.whiteSpace
              });
            }
          });
          return bad.slice(0, 30);
        });

        data.textOverflows = await page.evaluate(() => {
          const bad = [];
          document.querySelectorAll('h1,h2,h3,h4,p,span,a,button,th,td,label').forEach((el) => {
            const cs = getComputedStyle(el);
            const clipped = cs.whiteSpace === 'nowrap' || cs.overflowX === 'hidden' || cs.textOverflow === 'ellipsis';
            if (clipped && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 2) {
              bad.push({
                tag: el.tagName.toLowerCase(),
                id: el.id || null,
                cls: (el.className || '').toString().slice(0, 120),
                text: (el.textContent || '').trim().slice(0, 100),
                sw: el.scrollWidth,
                cw: el.clientWidth,
                ws: cs.whiteSpace,
                to: cs.textOverflow
              });
            }
          });
          return bad.slice(0, 30);
        });

        data.smallTaps = await page.evaluate(() => {
          const bad = [];
          const q = 'button,a,[role=button],input[type=button],input[type=submit],.tab,.nav-link,.close,.btn';
          document.querySelectorAll(q).forEach((el) => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            const visible = cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
            if (!visible) return;
            if (r.width < 40 || r.height < 40) {
              bad.push({
                tag: el.tagName.toLowerCase(),
                id: el.id || null,
                cls: (el.className || '').toString().slice(0, 120),
                text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 80),
                w: Math.round(r.width),
                h: Math.round(r.height)
              });
            }
          });
          return bad.slice(0, 40);
        });

        data.fixedSticky = await page.evaluate(() => {
          const arr = [];
          document.querySelectorAll('*').forEach((el) => {
            const cs = getComputedStyle(el);
            if (cs.position === 'fixed' || cs.position === 'sticky') {
              const r = el.getBoundingClientRect();
              if (r.width > 0 && r.height > 0) {
                arr.push({
                  tag: el.tagName.toLowerCase(),
                  id: el.id || null,
                  cls: (el.className || '').toString().slice(0, 120),
                  pos: cs.position,
                  top: Math.round(r.top),
                  left: Math.round(r.left),
                  w: Math.round(r.width),
                  h: Math.round(r.height),
                  z: cs.zIndex
                });
              }
            }
          });
          return arr.slice(0, 40);
        });

        data.ai = await page.evaluate(() => {
          const sels = [
            '#ai-assistant-fab', '#ai-fab', '.ai-assistant-fab', '#aiAssistantFab',
            '#ai-panel', '#ai-assistant-panel', '.ai-assistant-panel', '#chatbot-fab', '#chat-fab'
          ];
          const found = [];
          for (const s of sels) {
            const el = document.querySelector(s);
            if (el) {
              const r = el.getBoundingClientRect();
              const cs = getComputedStyle(el);
              if (r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden') {
                found.push({
                  sel: s,
                  pos: cs.position,
                  w: Math.round(r.width),
                  h: Math.round(r.height),
                  left: Math.round(r.left),
                  top: Math.round(r.top),
                  z: cs.zIndex
                });
              }
            }
          }

          const primary = document.querySelector('button.primary, .btn-primary, .btn, [type=submit]');
          let overlap = false;
          let overlapTarget = null;
          if (found.length && primary) {
            const fab = document.querySelector(found[0].sel);
            if (fab) {
              const fr = fab.getBoundingClientRect();
              const ar = primary.getBoundingClientRect();
              overlap = !(fr.right < ar.left || fr.left > ar.right || fr.bottom < ar.top || fr.top > ar.bottom);
              overlapTarget = (primary.textContent || primary.id || primary.className || '').toString().trim().slice(0, 80);
            }
          }
          return { found, overlap, overlapTarget };
        });
      }

      out.push(data);
      await ctx.close();
    }
  }

  await browser.close();
  fs.writeFileSync('mobile_qa_results.json', JSON.stringify(out, null, 2));

  const summary = out.map((r) => ({
    page: r.page,
    bp: r.breakpoint,
    err: !!r.navError,
    hScroll: r.hScroll ? r.hScroll.has : null,
    wide: r.wideNodes ? r.wideNodes.length : 0,
    text: r.textOverflows ? r.textOverflows.length : 0,
    smallTap: r.smallTaps ? r.smallTaps.length : 0,
    fixed: r.fixedSticky ? r.fixedSticky.length : 0,
    ai: r.ai ? r.ai.found.length : 0,
    aiOverlap: r.ai ? r.ai.overlap : false
  }));
  console.log(JSON.stringify(summary, null, 2));
})();

