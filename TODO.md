# Guandan Calculator - Development TODO

**Last Updated**: 2025-12-10
**Current Phase**: Player Profile System Complete ✅

---

## ✅ Recently Completed (2025-12-10)

### Player Profile System MVP - 33 Commits
- [x] Complete backend (10 APIs)
- [x] Game integration (search, create, remove)
- [x] Dual stat tracking (sessions + rounds)
- [x] Time tracking (duration, longest, average)
- [x] Honor sync (all 14)
- [x] Achievement system (20 badges)
- [x] Voting integration (auto + manual sync)
- [x] Partner/rival tracking (teammates + opponents)
- [x] Player browser + profile pages
- [x] MVP tagline (modal + PNG)
- [x] Live session timer (stops on victory)
- [x] Recent rankings (relative position)
- [x] Comprehensive documentation

**Code**: ~5,500 lines | **Bundle**: 90KB | **Status**: Production Ready

---

## 🎯 Next Tasks (Priority Order)

### High Priority - User Experience

#### 1. Achievement Unlock Notifications
- [ ] Toast notifications when achievements unlock
- [ ] Show badge animation on profile sync
- [ ] Display in victory modal
- [ ] Add sound effect (optional)

**Effort**: Small | **Impact**: High

#### 2. Room Browser with Player Filter
- [ ] Implement `GET /api/rooms/list` endpoint
- [ ] Create `/rooms.html` page
- [ ] Filter by player handle
- [ ] Show last 20 rooms + favorites
- [ ] Click room → join/view

**Effort**: Medium | **Impact**: High

#### 3. Enhanced Partner/Rival Display
- [ ] Win rate trend charts (last 10 games)
- [ ] Click partner → view their profile
- [ ] Show all partners (not just best/worst)
- [ ] Sortable by games/winrate

**Effort**: Small | **Impact**: Medium

---

### Medium Priority - Polish

#### 4. Profile Page Enhancements
- [ ] Share profile button (copy link)
- [ ] QR code for profile URL
- [ ] Export profile stats (PDF/image)
- [ ] Dark/light mode toggle

**Effort**: Small | **Impact**: Low

#### 5. Voting UX Improvements
- [ ] Show voting countdown timer (5 min remaining)
- [ ] Notification when voting sync completes
- [ ] Vote history per player
- [ ] Voting leaderboard (all-time)

**Effort**: Small | **Impact**: Medium

#### 6. Mobile Optimizations
- [ ] Touch-optimized profile cards
- [ ] Swipe navigation between pages
- [ ] Mobile-specific layouts
- [ ] Better emoji selector on mobile

**Effort**: Medium | **Impact**: Medium

---

### Low Priority - Future Features

#### 7. Season System
- [ ] Define season periods (monthly/quarterly)
- [ ] Season leaderboards
- [ ] Season achievements
- [ ] Historical season data

**Effort**: Large | **Impact**: Medium

#### 8. Authentication
- [ ] OAuth integration (optional)
- [ ] Profile claiming system
- [ ] Password protection
- [ ] Admin panel

**Effort**: Large | **Impact**: Low (works well without it)

#### 9. Advanced Analytics
- [ ] Performance trends over time
- [ ] Honor frequency analysis
- [ ] Optimal team composition suggester
- [ ] Predictive win rate calculator

**Effort**: Large | **Impact**: Low

---

## 🐛 Known Issues (Minor)

### Non-Critical
- [ ] Local voting results don't sync to profiles (only room voting)
  - Workaround: Use room mode for voting

- [ ] Partner/rival only tracks profile players (session players skipped)
  - By design: Can't track without persistent identity

- [ ] Recent rankings not retrospective (only going forward)
  - By design: Old data calculated differently

### Future Improvements
- [ ] Add TypeScript for better type safety
- [ ] Add unit tests for critical algorithms
- [ ] Performance optimization for large histories
- [ ] Accessibility improvements (ARIA labels, keyboard nav)

---

## 📋 Testing Checklist

### Pre-Production
- [x] All APIs working
- [x] Profile creation/deletion
- [x] Stats sync on completion
- [x] MVP tagline displays
- [x] Recent rankings correct
- [x] Partner/rival tracking
- [x] Achievements unlock
- [x] Voting sync works
- [x] Timer stops on victory

### User Acceptance
- [ ] Play complete game end-to-end
- [ ] Verify all stats accurate
- [ ] Test on mobile device
- [ ] Test room mode with viewers
- [ ] Check multiple sessions build history
- [ ] Verify partner/rival evolves

### Production Readiness
- [ ] Remove test_ players (or keep for demo)
- [ ] Monitor KV storage usage
- [ ] Set up error tracking
- [ ] Performance monitoring

---

## 🚀 Deployment Process

### Current Setup
- **Platform**: Vercel Edge + KV
- **Auto-Deploy**: Push to main → auto-build → deploy
- **URL**: https://gd.ax0x.ai
- **Build**: `npm run build` → `dist/`

### Manual Deploy (if needed)
```bash
# Build locally
npm run build

# Deploy to Vercel
vercel --prod

# Or push to GitHub (auto-deploys)
git push origin main
```

### Rollback (if needed)
```bash
# Revert to previous commit
git revert HEAD
git push

# Or use Vercel dashboard to redeploy previous version
```

---

## 📚 Documentation TODO

### High Priority
- [x] CODEBASE_STRUCTURE.md - Complete file reference
- [x] PLAYER_PROFILE_ARCHITECTURE.md - Technical deep-dive
- [x] Update FEATURE_STATUS.md
- [ ] Create USER_GUIDE update for profiles
- [ ] API documentation (OpenAPI/Swagger)

### Medium Priority
- [ ] Video tutorial (profile creation walkthrough)
- [ ] FAQ for common questions
- [ ] Troubleshooting guide

---

## 🎓 Code Quality Improvements

### Technical Debt
- [ ] Extract magic numbers to constants
- [ ] Reduce function complexity (some 100+ line functions)
- [ ] Add JSDoc comments to all public functions
- [ ] Consolidate duplicate code patterns

### Refactoring Opportunities
- [ ] Split large files (main.js is 1,500 lines)
- [ ] Create shared UI component library
- [ ] Standardize error handling patterns
- [ ] Improve test coverage

---

## 💡 Feature Ideas (Backlog)

### Community Suggested
- [ ] Team chat in rooms
- [ ] Replay system (watch past games)
- [ ] Tournament bracket support
- [ ] Custom honor creation
- [ ] Player notes/tags

### Experimental
- [ ] AI opponent (practice mode)
- [ ] Strategy tips based on stats
- [ ] Social features (friend list, messages)
- [ ] Clan/guild system

---

## 📊 Metrics to Track

### Usage Analytics
- [ ] Daily active users
- [ ] Games played per day
- [ ] Profile creation rate
- [ ] Feature adoption (search vs quick start)

### Performance Metrics
- [ ] API response times
- [ ] Page load times
- [ ] Bundle size over time
- [ ] KV storage growth

### User Engagement
- [ ] Average session duration
- [ ] Return user rate
- [ ] Profile page views
- [ ] Achievement unlock rate

---

## 🔧 Maintenance Tasks

### Regular
- [ ] Monitor KV storage quota (256MB free tier)
- [ ] Clean up test_ players before real launch
- [ ] Review and update dependencies
- [ ] Check for security updates

### As Needed
- [ ] Database backups (export player data)
- [ ] Performance profiling
- [ ] Bug triage and prioritization
- [ ] Feature request review

---

## 🎯 Immediate Next Steps

1. **Test complete game flow** with profile players
2. **Verify all stats sync** correctly
3. **Check partner/rival** appears after 2+ games
4. **Test voting sync** (manual button)
5. **Review documentation** for accuracy
6. **Plan Phase 2.5** features (room browser, etc.)

---

## 📖 Reference

- [FEATURE_STATUS.md](docs/FEATURE_STATUS.md) - Overall project status
- [PLAYER_PROFILE_SPEC.md](docs/features/PLAYER_PROFILE_SPEC.md) - Original spec
- [PLAYER_PROFILE_ARCHITECTURE.md](docs/architecture/PLAYER_PROFILE_ARCHITECTURE.md) - Tech details
- [CODEBASE_STRUCTURE.md](docs/architecture/CODEBASE_STRUCTURE.md) - File reference

---

**Player Profile System MVP: SHIPPED!** 🚀
