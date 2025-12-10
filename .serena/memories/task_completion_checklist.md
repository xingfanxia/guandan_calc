# Task Completion Checklist

When completing a development task, follow these steps:

## 1. Code Changes
- [ ] Ensure all changes follow the ES6 module pattern
- [ ] Update imports/exports if module dependencies changed
- [ ] Maintain consistent naming conventions (camelCase functions/variables)
- [ ] Add inline comments only for complex logic or cultural references

## 2. Testing (Manual)
- [ ] Test in development server (`npm run dev`)
- [ ] Verify functionality works in all game modes (4/6/8 players)
- [ ] Test on desktop (drag-drop with mouse)
- [ ] Test on mobile (touch events, long-press drag)
- [ ] Test room sharing if applicable (create/join/sync)
- [ ] Test voting system if applicable
- [ ] Test export functionality if applicable (TXT/CSV/PNG)

## 3. Build Verification
- [ ] Run `npm run build` to ensure production build succeeds
- [ ] Check for any Vite build warnings or errors
- [ ] Preview production build with `npm run preview`
- [ ] Verify no console errors in production build

## 4. Documentation
- [ ] Update `docs/FEATURE_STATUS.md` if completing a feature
- [ ] Update `docs/PROJECT_OVERVIEW.md` if adding major functionality
- [ ] Update `CLAUDE.md` if changing architecture or key patterns
- [ ] Add/update technical documentation in `docs/architecture/` if needed

## 5. Git Workflow
- [ ] Stage relevant files: `git add <files>`
- [ ] Write clear commit message describing the change
- [ ] Commit: `git commit -m "feat: description"` or `git commit -m "fix: description"`
- [ ] Push to repository: `git push`

## 6. Deployment (if applicable)
- [ ] Verify Vercel deployment succeeds (check Vercel dashboard)
- [ ] Test production URL after deployment
- [ ] Monitor for any edge function errors in Vercel logs
- [ ] Verify Vercel KV integration if room features were changed

## 7. Special Considerations

### For Game Logic Changes
- [ ] Reference `src/app.js` (legacy monolith) for correct implementation
- [ ] Test A-level rules carefully (strict vs lenient modes)
- [ ] Verify roundOwner tracking for A-level logic
- [ ] Test upgrade calculations for all player modes

### For Real-Time Features
- [ ] Verify host auto-sync (10-second interval)
- [ ] Verify viewer polling (5-second interval)
- [ ] Test auth token validation
- [ ] Check Vercel KV TTL settings

### For Honor Calculations
- [ ] Verify all 14 honors calculate correctly
- [ ] Test algorithms scale properly for 4/6/8 player modes
- [ ] Ensure clickable explanations show correct statistics

### For Export Features
- [ ] Test all export formats (TXT, CSV, mobile PNG, desktop PNG)
- [ ] Verify UTF-8 Chinese character encoding
- [ ] Check mobile PNG optimization (600px width)
- [ ] Ensure all 14 honors appear in exports

## No Automated Checks Currently
Note: The project currently has no automated linting, formatting, or testing configured. All quality checks are manual.
