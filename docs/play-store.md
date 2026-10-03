# Google Play: listing, Data safety and content rating

Everything Play Console asks for, drafted from the code. The Android app itself (Trusted Web Activity, Bubblewrap, signing, asset links) is in [`deploy.md` §17](deploy.md#17-android-app-trusted-web-activity).

**Revisit this page when a feature changes what the app collects** (for example profiles, bio and follows): the Data safety answers must match the app, and Google can reject or remove an app whose answers are wrong.

## 1. App details

| Field | Value |
|---|---|
| App name | SpotOn |
| Package name | `hu.isolapaul.spoton` (permanent) |
| Default language | English (en-US); translations: Hungarian (hu-HU), German (de-DE) |
| App or game | App |
| Free or paid | Free |
| Category | Travel & Local |
| Tags | Travel, Maps, Local, Photography (pick what Play Console offers) |
| Contact e-mail | the public contact address (`NEXT_PUBLIC_CONTACT_EMAIL`) |
| Website | https://spoton.isolapaul.hu |
| Privacy policy | https://spoton.isolapaul.hu/privacy |
| Account deletion (Data safety) | https://spoton.isolapaul.hu/account-deletion |
| Ads | No, the app contains no ads |

## 2. Store listing texts

Limits: name 30 characters, short description 80, full description 4000.

### English (en-US)

**Short description**
> Discover and share viewpoints, hidden gems and places worth the trip.

**Full description**
> SpotOn is a map of places people actually love: viewpoints, quiet riverbanks, hiking trails, date spots and hidden corners of the city, shared by the community.
>
> - Explore the map: every pin is a place someone recommends, with photos, a short description and ratings.
> - Find what is near you: sort by distance or by rating, and filter by category.
> - Add your own spots: drop a pin, add photos and a few words. Every new spot is checked before it appears on the map.
> - Rate and review: leave stars and tips for others, and save your favourites.
> - Level up: the more you share, the higher your level, with new perks along the way.
> - Get directions: open any spot in your maps app with one tap.
>
> Your privacy: your location stays on your device and is only used to show what is near you. Location data is removed from the photos you upload. No ads, no tracking.
>
> SpotOn is free and available in English, Hungarian and German.

### Hungarian (hu-HU)

**Rövid leírás**
> Fedezz fel és ossz meg kilátókat, rejtett helyeket és különleges spotokat.

**Teljes leírás**
> A SpotOn azoknak a helyeknek a térképe, amelyeket az emberek tényleg szeretnek: kilátók, csendes folyópartok, túraútvonalak, randihelyek és a város rejtett zugai, a közösség ajánlásával.
>
> - Böngészd a térképet: minden pin egy ajánlott hely, fotókkal, rövid leírással és értékelésekkel.
> - Találd meg, ami a közeledben van: rendezd távolság vagy értékelés szerint, és szűrj kategóriára.
> - Oszd meg a saját helyeidet: tegyél le egy pint, adj hozzá fotókat és pár mondatot. Minden új hely ellenőrzés után kerül a térképre.
> - Értékelj és írj véleményt: adj csillagokat és tippeket másoknak, és mentsd el a kedvenceidet.
> - Szintlépés: minél többet osztasz meg, annál magasabb a szinted, közben új lehetőségekkel.
> - Útvonaltervezés: egy koppintással megnyithatod bármelyik helyet a térképalkalmazásodban.
>
> Adatvédelem: a helyzeted a készülékeden marad, és csak arra használjuk, hogy megmutassuk, mi van a közeledben. A feltöltött fotókból eltávolítjuk a helyadatokat. Nincs reklám, nincs követés.
>
> A SpotOn ingyenes, és magyarul, angolul és németül is elérhető.

### German (de-DE)

**Kurzbeschreibung**
> Entdecke und teile Aussichtspunkte, versteckte Orte und besondere Plätze.

**Vollständige Beschreibung**
> SpotOn ist eine Karte mit Orten, die Menschen wirklich lieben: Aussichtspunkte, ruhige Flussufer, Wanderwege, Date-Spots und versteckte Ecken der Stadt, geteilt von der Community.
>
> - Entdecke die Karte: Jeder Pin ist ein empfohlener Ort, mit Fotos, einer kurzen Beschreibung und Bewertungen.
> - Finde, was in deiner Nähe ist: Sortiere nach Entfernung oder Bewertung und filtere nach Kategorie.
> - Teile deine eigenen Orte: Setze einen Pin, füge Fotos und ein paar Worte hinzu. Jeder neue Ort wird geprüft, bevor er auf der Karte erscheint.
> - Bewerte und schreibe Tipps: Vergib Sterne, gib anderen Tipps und speichere deine Favoriten.
> - Steige im Level auf: Je mehr du teilst, desto höher dein Level, mit neuen Vorteilen unterwegs.
> - Route planen: Öffne jeden Ort mit einem Tippen in deiner Karten-App.
>
> Deine Privatsphäre: Dein Standort bleibt auf deinem Gerät und wird nur genutzt, um zu zeigen, was in deiner Nähe ist. Aus hochgeladenen Fotos werden die Standortdaten entfernt. Keine Werbung, kein Tracking.
>
> SpotOn ist kostenlos und auf Deutsch, Englisch und Ungarisch verfügbar.

## 3. Graphics

| Asset | Size | File |
|---|---|---|
| App icon | 512 × 512 PNG, full square (Google applies the mask) | `docs/play-store/icon-512.png` |
| Feature graphic | 1024 × 500 PNG | `docs/play-store/feature-graphic.png` |
| Phone screenshots (English) | 1080 × 1920 JPEG, 9:16 | `public/screenshots/01-map.jpg` … `05-profile.jpg` |

The same screenshots are in the web manifest. Regenerate everything after a UI change with `npm run store:assets`: it seeds the emulators with the demo content in `scripts/store/demo-data.ts` (free Pexels photos, downloaded at run time) and runs `scripts/store/capture.spec.ts` with real map tiles. Use the same English screenshots for the Hungarian and German listings, or leave those empty (Play then shows the default-language ones).

## 4. Data safety (draft)

Play's definitions: data is **collected** when it leaves the device; it is **shared** when it goes to a third party other than a service provider working on our behalf. Firebase (Google Cloud) and Cloudflare are service providers, so nothing is shared.

**Overview questions**

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | Yes |
| Is all of the user data collected by your app encrypted in transit? | Yes (HTTPS only) |
| Do you provide a way for users to request that their data is deleted? | Yes: in the app (Settings → Delete account) and at https://spoton.isolapaul.hu/account-deletion |

**Data types**

| Category → type | Collected | Shared | Required or optional | Purposes | What it is |
|---|---|---|---|---|---|
| Personal info → Email address | Yes | No | Required | Account management, App functionality | Sign-in (Firebase Auth) |
| Personal info → User IDs | Yes | No | Required | Account management, App functionality | Account id and the public username |
| Photos and videos → Photos | Yes | No | Optional | App functionality | Spot photos, profile picture and banner, feedback attachments (EXIF location removed) |
| App activity → Other user-generated content | Yes | No | Optional | App functionality | Spots (name, description, category, the map position the user picks), reviews, favourites, likes, the profile bio, feedback messages |
| App activity → Other actions | Yes | No | Optional | App functionality | Highlights, image likes, follows and follow requests, profile visibility, notification settings, the people-search counter |
| Device or other IDs | Yes | No | Optional | App functionality | Push notification token (only when notifications are turned on) |

**Not collected:** location (the device position is used on the device only, for distance and centring; the position of a spot is content the user chooses and is covered above), contacts, calendar, health, financial info, messages between users, audio, files, web browsing, app diagnostics and crash logs, analytics, advertising IDs.

**Processed but not a Data safety type:** the server and Cloudflare log IP addresses for security and rate limiting (privacy policy §2, "Technikai adatok"). If Play Console asks, answer as "not used to derive location, not collected for any listed purpose".

**Change this when:** analytics, crash reporting or ads are added, or a new kind of user data is stored. (Bio, follows and follow requests are covered above since v2.1.0.) Mapbox, which serves the map, receives the IP address and the viewed map area directly from the browser as a service provider; that is not a Data safety type.

## 5. Content rating (IARC questionnaire)

| Question | Answer |
|---|---|
| Category | All other app types (a map and community app, not a game) |
| Violence, fear, sexuality, gambling, crude humour, drugs/alcohol/tobacco depicted by the app | No |
| Users can interact or exchange content | Yes: public usernames, spots, photos and reviews |
| Shares the user's current physical location with other users | No (only places the user chooses to publish) |
| Allows purchases of digital goods | No |
| Unrestricted internet access (web browser, search engine) | No |

Expected result: the lowest age ratings, with the interactive element "Users Interact".

## 6. Target audience and app content

| Section | Answer |
|---|---|
| Target age groups | 16–17 and 18+ (the terms require 16+; not designed for children, so the Families policy does not apply) |
| Ads | No ads |
| App access | Some features need an account: give the reviewers a test account (e-mail + password, created for them, no admin rights) in Play Console → App content → App access |
| News app | No |
| Government app | No |
| Financial features | None |
| Health | None |

## 7. Account and testing (personal developer account)

1. **Create the account** at https://play.google.com/console/signup as a *personal* account: US$ 25 once, identity verification with a government ID and a card in your legal name, and a verified phone number and e-mail. Verification can take a few days.
2. **Create the app** (App name, default language, App, Free) and fill in every section of *App content* and the *Store listing* from this page.
3. **Internal testing** (optional, instant): upload the first `.aab`, install it yourself and check the device items in `deploy.md` §17.
4. **Closed testing (required):** personal accounts created after 13 November 2023 must run a closed test with **at least 12 testers opted in continuously for 14 days** before they can apply for production ([Play Console Help](https://support.google.com/googleplay/android-developer/answer/14151465)). Add the testers' Google accounts (an e-mail list or a Google Group), send them the opt-in link, and ask them to stay opted in and to send feedback.
5. **Apply for production** on the Dashboard after the 14 days: the form asks about the closed test, the app and its readiness (summarise the testers' feedback).
6. **Production release:** review usually takes from a few hours to several days.
