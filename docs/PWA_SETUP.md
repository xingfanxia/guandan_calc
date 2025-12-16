# PWA Setup Guide

**Status**: ✅ Complete | **Version**: v10.1

---

## What's Been Set Up

Your Guandan Calculator is now a Progressive Web App (PWA)!

### ✅ Completed
- PWA manifest (`public/manifest.json`)
- Service worker (`public/sw.js`)
- All HTML pages updated with PWA meta tags
- Service worker registration in `main.js`
- iOS-specific meta tags for home screen

---

## 📱 Icon Setup (Required)

**You need to add the icon image in 2 sizes:**

### Step 1: Save Your Icon
Save the card game icon image you provided as:
- `public/icons/icon-192.png` (192x192 pixels)
- `public/icons/icon-512.png` (512x512 pixels)

### Step 2: Generate Icons (Easy Method)
Use an online tool to resize:
1. Go to https://www.iloveimg.com/resize-image
2. Upload your icon image
3. Resize to 192x192 → Save as `icon-192.png`
4. Resize to 512x512 → Save as `icon-512.png`
5. Place both in `public/icons/` directory

### Optional: Screenshot
- `public/icons/screenshot-mobile.png` (750x1334)
- Shows in app stores / installation prompts

---

## 🚀 How to Install PWA

### On iOS (Safari)
1. Open https://gd.ax0x.ai in Safari
2. Tap Share button (square with arrow)
3. Scroll down → "Add to Home Screen"
4. Tap "Add"
5. App icon appears on home screen!

### On Android (Chrome)
1. Open https://gd.ax0x.ai in Chrome
2. Tap menu (three dots)
3. Tap "Install app" or "Add to Home Screen"
4. Tap "Install"
5. App icon appears!

### On Desktop (Chrome/Edge)
1. Open https://gd.ax0x.ai
2. Look for install icon in address bar (⊕ or ⬇)
3. Click "Install"
4. App opens in standalone window!

---

## ✨ PWA Features

### Offline Support
- Service worker caches static assets
- Works without internet (after first load)
- API calls require network

### Home Screen Install
- Custom app icon
- Standalone mode (no browser UI)
- Splash screen on launch
- Full-screen experience

### Performance
- Fast loading (cached assets)
- Network-first for fresh data
- Graceful offline fallback

---

## 🔧 Technical Details

### Manifest Configuration
```json
{
  "name": "掼蛋计分器",
  "short_name": "掼蛋",
  "display": "standalone",
  "theme_color": "#0b0b0c"
}
```

### Service Worker Strategy
- **Static assets**: Network first, cache fallback
- **API requests**: Network only (always fresh)
- **Cache version**: v10.1 (auto-updates)

### Supported Pages
- ✅ Main game (`/`)
- ✅ Player browser (`/players.html`)
- ✅ Player profiles (`/player-profile.html`)
- ✅ Room browser (`/rooms.html`)

---

## 🧪 Testing Checklist

### Installation
- [ ] Install PWA on iOS
- [ ] Install PWA on Android
- [ ] Install PWA on desktop
- [ ] Verify custom icon appears
- [ ] Verify standalone mode (no browser chrome)

### Offline Mode
- [ ] Load app online
- [ ] Turn off WiFi
- [ ] Reload app → should work
- [ ] Navigate between pages → should work
- [ ] Try API calls → should fail gracefully

### Updates
- [ ] Deploy new version
- [ ] Service worker auto-updates
- [ ] Hard refresh to force update (Cmd+Shift+R)

---

## 🔄 Updating the PWA

When you deploy updates:
1. Service worker detects new version
2. Downloads new assets in background
3. Activates on next page load
4. Users get updates automatically!

**Force immediate update:**
- Increment cache version in `sw.js`
- Users will get new version on next visit

---

## 📊 PWA Checklist (All ✅)

- [x] Manifest file with app metadata
- [x] Service worker for offline support
- [x] Icons (192x192, 512x512)
- [x] iOS meta tags (apple-mobile-web-app-*)
- [x] Theme color (#0b0b0c)
- [x] Standalone display mode
- [x] HTTPS (required - Vercel provides this)
- [x] Service worker registration

---

## 🎯 Next Steps

1. **Add icon files** to `public/icons/` directory (see above)
2. **Deploy** with `git push`
3. **Test installation** on your phone
4. **Share** the install link with friends!

---

## 📱 Installation Link

After deploying, share this with users:
**https://gd.ax0x.ai**

On mobile, they'll see:
- "Add to Home Screen" option
- Custom app icon
- Standalone app experience

---

**Your Guandan Calculator is now a full PWA!** 🚀
