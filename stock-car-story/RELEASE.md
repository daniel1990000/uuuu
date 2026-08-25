# Shipping Stock Car Story

The game is a self-contained web app in `www/`. It ships three ways from the
same source: as a website/PWA, as an Android app (Google Play), and as an iOS
app (App Store). Capacitor wraps `www/` in a native shell — there is no build
step to configure and no framework to learn.

---

## 0. One-time setup

```bash
cd stock-car-story
npm install
```

Local testing:

```bash
npm run serve          # http://localhost:8080
npm run build          # dist/index.html — one self-contained file
npm run icons          # regenerate every icon from code
```

Test on a real phone before anything else: run `npm run serve`, find your
machine's LAN IP, and open `http://<ip>:8080` on the handset. Everything —
touch targets, safe areas, the pixel scaling — is tuned for a phone in
portrait, and an emulator will lie to you about how the buttons feel.

---

## 1. Android → Google Play

### 1.1 Add the platform

```bash
npm run cap:add:android
npm run cap:sync
```

This generates an `android/` Gradle project. Commit it; it is yours to edit.

### 1.2 Set the application ID

`capacitor.config.json` ships with `com.yourstudio.stockcarstory`. **Change
`yourstudio` to something you actually own before your first upload** — the
application ID is permanent once a build is live on Play, and it cannot be
changed afterwards. Then re-run `npm run cap:sync`.

### 1.3 Version numbers

Each upload needs a higher `versionCode` than the last. In
`android/app/build.gradle`:

```gradle
defaultConfig {
    versionCode 1          // integer, +1 every upload
    versionName "1.0.0"    // what players see
}
```

### 1.4 Create a signing key

Play signs with an upload key you generate once. **Back it up — losing it
means you cannot update your own app.**

```bash
keytool -genkey -v -keystore stockcar-upload.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

Store it outside the repo and add to `android/key.properties` (git-ignored):

```properties
storeFile=/absolute/path/to/stockcar-upload.jks
storePassword=…
keyAlias=upload
keyPassword=…
```

Wire it into `android/app/build.gradle` per the Capacitor docs
(`signingConfigs.release` reading `key.properties`).

### 1.5 Build the release bundle

```bash
npm run build          # optional: refresh dist
npm run cap:sync       # copy www/ into the native project
npm run android:release
```

Output: `android/app/build/outputs/bundle/release/app-release.aab` — that
`.aab` is what you upload.

### 1.6 Play Console checklist

Google will not let you publish until all of these are green:

- [ ] Developer account (one-time US$25)
- [ ] App created, package name matches your application ID
- [ ] **Privacy policy URL** — required even though this game collects nothing.
      A single page saying "this app stores your save file on your device and
      transmits nothing" satisfies it. Host it anywhere public.
- [ ] Data safety form — declare: no data collected, no data shared
- [ ] Content rating questionnaire — expect **Everyone / PEGI 3**
- [ ] Target audience and ads declaration (currently: no ads)
- [ ] Store listing: title, short description, full description (see `STORE.md`)
- [ ] Graphics: 512×512 icon, 1024×500 feature graphic, 2–8 phone screenshots
- [ ] Signed `.aab` uploaded to internal testing first
- [ ] Test on internal track on a real device, then promote to production

New personal developer accounts must run a **closed test with at least 12
testers for 14 continuous days** before production access unlocks. Start that
clock early — it is usually the longest pole in the schedule.

---

## 2. iOS → App Store

You need a Mac with Xcode and an Apple Developer Program membership
(US$99/year). Everything else is already prepared.

```bash
npm run cap:add:ios
npm run cap:sync
npm run ios:open       # opens Xcode
```

In Xcode:

1. Select the project → Signing & Capabilities → your team. Let Xcode manage
   signing.
2. Set the bundle identifier to match your Android application ID.
3. Deployment target iOS 14+.
4. Device orientation: **Portrait only** (the game is portrait-locked).
5. Add the launch screen background `#1b2a6b` so the boot flash matches.
6. Product → Archive → Distribute App → App Store Connect.

App Store Connect checklist:

- [ ] App record created, bundle ID matches
- [ ] Privacy policy URL (same page as Android)
- [ ] App Privacy questionnaire: no data collected
- [ ] Age rating: 4+
- [ ] Screenshots for 6.7" and 6.5" iPhone (required sizes)
- [ ] Description, keywords, support URL
- [ ] Build uploaded, then submitted for review

Apple rejects thin wrappers around a website. This is fine — the game is fully
offline, ships its own content, and never loads a remote URL. Keep it that way:
do not add a WebView pointing at a live site.

---

## 3. Web / PWA / itch.io

The `www/` folder is a complete static site. Upload it to any static host and
it installs to a phone home screen as a fullscreen app, works offline via
`sw.js`, and keeps saves in `localStorage`.

For itch.io, upload `dist/index.html` alone — it is one self-contained file and
needs nothing else. This is the fastest route to having something playable in
front of people, and it costs nothing.

**When you deploy an update, bump `CACHE` in `www/sw.js`.** Returning players
are served from cache until that string changes.

---

## 4. Making money

The game currently has no monetization wired in — deliberately. Nothing about
the design blocks it, and these are the realistic options in the order I would
try them:

1. **Paid app (US$2–4).** Fits the genre; this is exactly how Kairosoft sells
   theirs. No SDKs, no privacy disclosures, no ad review. Simplest by far.
2. **Free with a single unlock IAP.** Free through the first championship, one
   purchase unlocks the rest. Add `@capacitor-community/in-app-purchases`. The
   natural gate already exists: the garage-level progression.
3. **Rewarded video only** (AdMob). Sensible placements already exist in the
   design: an extra aura, halve a repair bill, re-run a wet qualifying lap.
   Never interstitials between races — it would wreck the pacing that makes
   the loop work.

If you take ads or IAP, both stores' data-safety declarations change, and you
will need a real privacy policy covering the ad SDK. Option 1 avoids all of it.

---

## 5. Release hygiene

- Bump `versionCode`/`versionName` and `CACHE` in `sw.js` together.
- Re-run `npm run cap:sync` after **every** change to `www/` — Capacitor copies
  the web assets at sync time, not at build time. Forgetting this ships the
  previous build's game inside a new binary, and it looks exactly like "my fix
  didn't work".
- Save compatibility: `state.js` checks `G.v` on load and refuses a mismatched
  version rather than crashing. If you change the shape of the save object,
  bump `v` and add a migration, or existing players lose their careers.
