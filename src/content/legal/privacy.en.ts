import type { LegalDocument } from './types';

// English translation of privacy.hu.ts (item 9). The Hungarian text is authoritative; keep the two
// in step (same sections, same facts) whenever either changes.
export const PRIVACY_EN: LegalDocument = {
  lang: 'en',
  title: 'Privacy Policy',
  updated: 'Last updated: 30 September 2026',
  intro: [
    'This is an English translation for convenience; the Hungarian version is authoritative.',
    'This policy explains which personal data SpotOn (https://spoton.isolapaul.hu) processes, why, for how long, who can access it, and what rights you have. SpotOn is a free, non-commercial hobby project run by a private individual.',
  ],
  sections: [
    {
      heading: '1. Controller',
      blocks: [
        ['Name: {controller}', 'E-mail: {email}'],
        'You can send privacy questions and requests to this e-mail address. We are not required to appoint a data protection officer.',
      ],
    },
    {
      heading: '2. What data we process, for what purpose and on what legal basis',
      blocks: [
        'Registration requires an e-mail address (or a Google account) and a username; without them you cannot create an account. All other data (profile picture, bio, spots, reviews, follows, notifications, location, feedback) is optional; if you do not provide it, you cannot use that feature.',
        'Account and profile. Your e-mail address, your Firebase ID, your username, for Google sign-in the name and profile picture address of your Google account, your chosen name colour, font and pin icon, your bio (up to 150 characters), whether your profile is public or private and whether it shows your saved spots, your language, the number of spots you uploaded, your experience points (XP) and level, and when and which version of the Terms of Use and this policy you accepted. Purpose: creating the account, signing in and showing the profile. Legal basis: providing the service under the Terms of Use, i.e. performance of a contract (GDPR Art. 6(1)(b)). Retention: until the account is deleted. Inactive accounts are not deleted automatically.',
        'Profile picture and banner. The images you upload. Legal basis and retention as for the account.',
        'Levels. The server computes your XP and level from your approved spots, your approved photos and your reviews of other people\'s spots; if any of these is deleted, its XP goes too, but your level never drops below the one you reached under the earlier, spot-count based system. Legal basis and retention as for the account.',
        'Follows. Whom you follow, who follows you, and your follow requests not yet answered (who sent one to whom, and when). The numbers of followers and followed users are public, the lists are not: a follow is seen only by the two people concerned. With a private profile, only followers you accept see the list of your spots on your profile; your approved spots stay visible to everyone on the map. Legal basis: performance of a contract. Retention: until the follow ends, the request is answered or cancelled, or the account is deleted.',
        'User search. Signed-in users can search by the beginning of a username (at least 2 characters, at most 10 results); a result shows the username, profile picture, level and whether the profile is private. To prevent abuse we count each user\'s searches (at most 20 per minute) and when we last notified someone of your follow request. Legal basis: legitimate interest (protecting the service). Retention: until the account is deleted.',
        'Spots. The name, category and description you enter, the exact coordinates of the place, the photos, the time of upload and the uploader\'s name. Approved spots are public to everyone, even without signing in; spots waiting for approval and rejected spots are seen only by you and the admins. Location data (EXIF, e.g. GPS coordinates) is removed from photos on your device before upload. Legal basis: performance of a contract. Retention: spots waiting for approval until approval or deletion; a rejected spot is kept together with the admin\'s reason so that you can fix and resubmit it, until an admin deletes it (we delete it on request); approved spots until the account is deleted, afterwards without a link to the uploader (see section 4).',
        'Moderation. Changes to your approved spots and photos other people add to spots appear after an admin approves them; until then we store the proposed change, or the photo and its uploader. You receive the admin\'s decision (with the reason for a rejection or deletion) in the app\'s notification centre and as a push notification; the notification centre keeps at most 50 entries until you clear them. Legal basis: performance of a contract (moderation under the Terms of Use). Retention: until the decision, and for notifications until you clear them or the account is deleted.',
        'Reviews, photos on other people\'s spots, likes, favourites and highlights. Reviews are public together with your name and profile picture. Legal basis: performance of a contract. Retention: until the account is deleted; they are deleted with the account.',
        'Push notifications. If you allow them, we store your device\'s notification token (FCM token), your notification settings and your language so that we can send notifications (for example when your spot is approved or reviewed, when you receive a follow request, or when someone you follow shares a new spot). Legal basis: your consent (Art. 6(1)(a)), which you can withdraw at any time in Settings or in your browser; withdrawal does not affect the lawfulness of earlier processing. When you sign out, that device\'s token is deleted.',
        'Location. If you allow it in your browser, your exact location is used only on your device: to centre the map and to compute distances. Your location is not sent to our servers and not stored; it stays in the browser\'s session storage on your device for at most 10 minutes. Legal basis: your consent, which you can withdraw at any time in the browser settings.',
        'Feedback. The text of your message and the attached images; if you are signed in, your name or username, your Firebase ID and (if verified) your e-mail address, so that we can reply. The message reaches the controller by e-mail. Legal basis: legitimate interest (Art. 6(1)(f)): fixing bugs and keeping in touch. Retention: until the matter is closed, at most 1 year. To protect against overload, your IP address is kept in the server\'s memory for at most a few minutes and is not saved.',
        'Technical data. With every request your browser sends your IP address and browser details. The logs of Cloudflare and of our own server are kept for at most 1 year. Cloud Function logs may contain your Firebase ID; Google keeps them for 30 days by default. Firebase keeps the IP addresses recorded at sign-in for a few weeks. Legal basis: legitimate interest (security and operation of the service).',
        'Backups. We back up the database from time to time and keep the backups for at most 1 year; deleted data disappears from the backups within that time at the latest. Firebase deletes the sign-in data of deleted accounts from its own systems within 180 days at the latest.',
      ],
    },
    {
      heading: '3. Data stored on your device (cookies and local storage)',
      blocks: [
        'SpotOn uses no advertising or analytics cookies and does not track you on other sites. Your browser\'s local storage (localStorage, sessionStorage, IndexedDB) holds only data needed for the app to work: the sign-in state (Firebase), the chosen language, the map style, the list of in-app notifications, the state of the install and notification prompts, and your location for at most 10 minutes. Cloudflare may set a short-lived, strictly necessary cookie for security. These are strictly necessary to provide the service, so under section 155(4) of Hungarian Act C of 2003 on electronic communications they need no consent. You can delete them at any time in your browser settings.',
      ],
    },
    {
      heading: '4. Deleting your account',
      blocks: [
        'You can delete your account at any time in Profile → Settings → Delete account, or request it by e-mail. If you are an admin, first ask for your admin rights to be removed. On deletion:',
        [
          'your account (sign-in), profile, username, bio, profile picture and banner, notification tokens and settings, and the entries of your notification centre are deleted;',
          'your follows in both directions and your follow requests are deleted, as are your changes and photos waiting for approval;',
          'all your reviews, the photos you added to other people\'s spots, your likes and your highlights are deleted;',
          'the spots you uploaded and their photos stay on the community map without your name, profile picture and account ID; the photos are moved to storage not linked to your account. In logs and backups this link disappears within 1 year at the latest (see section 2). We keep these spots on the basis of our legitimate interest in a complete community map and in keeping the reviews others wrote about them (Art. 6(1)(f)).',
        ],
        'If you do not want a spot or photo you uploaded to remain, write to {email} before or after the deletion and we will remove it. Please also write if a remaining photo shows you or another recognisable person, or if the spot identifies you in another way. If a spot or photo is about you but you did not upload it, write to us as well and we will consider removing it.',
      ],
    },
    {
      heading: '5. Who can access the data',
      blocks: [
        'The data can be accessed by the controller and the admins appointed by the controller, who approve the submitted spots. If you are an admin, the other admins also see your e-mail address, username and profile picture; the super admin grants admin rights by e-mail address. We do not sell your data and do not use it for advertising.',
        'Public (visible even without signing in): your username, profile picture, name colour, font and pin icon, your bio, your level and XP, the numbers of your followers and followed users, whether your profile is private, whether you are an admin, approved spots with the uploader\'s name and profile picture, and reviews with your name and profile picture. With a public profile, the list of your approved spots, and if you turned it on your saved spots, are shown on your profile.',
        'The following providers may process data as processors or as independent providers:',
        [
          'Google Ireland Ltd. and Google LLC (Firebase: sign-in, database, file storage, cloud functions, push notifications). The database, file storage and cloud functions are in the European Union: the database in Belgium and the Netherlands (eur3), uploaded images in the Netherlands and Finland (EUR4), the cloud functions run in Frankfurt. The sign-in service and the delivery of notifications may also process data outside the EU. Google profile pictures load from Google\'s servers, so Google sees the IP address of whoever displays them.',
          'Browser vendors: notifications are delivered to your device by the push service of your browser\'s vendor (e.g. Google, Mozilla, Apple, Microsoft).',
          'Google (Gmail): feedback arrives in a Gmail account; Google may also process the data independently as an e-mail provider (Google Ireland Ltd.).',
          'Cloudflare, Inc.: traffic to the website passes through Cloudflare\'s network (IP address, request data).',
          'Map provider: Mapbox, Inc. (USA). When the map loads, your browser sends your IP address, browser details and the map area you view directly to Mapbox, which also counts map loads as anonymous usage data (for billing). The map is built on data from Mapbox and the OpenStreetMap contributors. Purpose: showing the map; legal basis: our legitimate interest (Art. 6(1)(f)). Mapbox\'s own privacy policy covers its further processing (mapbox.com/legal/privacy).',
          'The app\'s server runs on the controller\'s own server in Hungary.',
        ],
        'Transfers outside the EU (to the USA) are based on the EU–US Data Privacy Framework (Commission adequacy decision (EU) 2023/1795) or on the standard contractual clauses adopted by the Commission. These are available in the providers\' data processing terms (Firebase: firebase.google.com/terms/data-processing-terms; Cloudflare: cloudflare.com/cloudflare-customer-dpa; Mapbox: mapbox.com/legal/dpa); we send a copy on request.',
      ],
    },
    {
      heading: '6. Security',
      blocks: [
        'Access to the data is restricted by security rules and server-side checks; the connection is always encrypted (HTTPS). Spots waiting for approval and rejected spots are seen only by their submitter and the admins, follows only by the two people concerned, and your saved spots only by you (or, if you show them, by those who can see your profile).',
      ],
    },
    {
      heading: '7. Your rights',
      blocks: [
        [
          'Access: you can ask what data we process about you and request a copy.',
          'Rectification: you can correct most data yourself in your profile; we correct the rest on request.',
          'Erasure: you can delete your account yourself (section 4) or request deletion.',
          'Restriction of processing.',
          'Data portability: on request we provide the data you gave us in a machine-readable format.',
          'Withdrawal of consent (push notifications, location) at any time.',
        ],
        'Right to object: you can object at any time at {email} to processing based on legitimate interest (feedback, technical logs, the search counter, spots kept after account deletion, loading the map). We then stop processing the data unless compelling legitimate grounds or legal claims justify it. You can learn the outcome of the balancing test on request.',
        'We reply to your request ({email}) within one month; where justified this may be extended by two more months, and we will tell you. If you feel we have infringed your rights, you can complain to the Hungarian National Authority for Data Protection and Freedom of Information (NAIH, 1055 Budapest, Falk Miksa utca 9–11.; postal address: 1363 Budapest, Pf. 9.; phone: +36 1 391 1400; e-mail: ugyfelszolgalat@naih.hu; website: https://naih.hu), or go to court; at your choice you can also bring the case before the regional court of your place of residence or stay.',
      ],
    },
    {
      heading: '8. Age limit',
      blocks: [
        'Only people aged 16 or over may register on SpotOn. We do not check age; you confirm it when registering. If we learn that someone under 16 has registered, we delete the account; if you notice this as a parent, please write to us.',
      ],
    },
    {
      heading: '9. Automated decision-making',
      blocks: [
        'We make no decisions about you based solely on automated processing and do not profile you. Submitted spots, changes and photos are approved or rejected by a person (an admin). XP and level are computed by a fixed rule that is the same for everyone (the level decides, for example, the number of highlights); this is not decision-making within the meaning of GDPR Art. 22.',
      ],
    },
    {
      heading: '10. Changes to this policy',
      blocks: [
        'If this policy changes materially, we announce it in the app before it takes effect. The current version is always on this page.',
      ],
    },
  ],
};
