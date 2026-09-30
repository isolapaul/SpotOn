import type { LegalDocument } from './types';

// English translation of terms.hu.ts (item 9). The Hungarian text is authoritative; keep the two
// in step whenever either changes.
export const TERMS_EN: LegalDocument = {
  lang: 'en',
  title: 'Terms of Use',
  updated: 'Last updated: 30 September 2026',
  intro: [
    'This is an English translation for convenience; the Hungarian version is authoritative.',
    'These terms apply to the use of SpotOn (https://spoton.isolapaul.hu). The Privacy Policy describes how your personal data is processed.',
    'You can read the terms before registering: this page and the Privacy Policy are linked from the sign-in window. You accept them by registering or signing in; users who registered earlier accept them in the app with the Accept button. We record the time of acceptance and the version of the terms at that time.',
    'The contract is concluded in Hungarian, in electronic form; it is not filed separately, and the current terms are always available on this page. You can correct input errors before submitting the registration.',
  ],
  sections: [
    {
      heading: '1. Provider',
      blocks: [
        ['Operator: {controller} (private individual)', 'E-mail: {email}'],
        'SpotOn is a free, non-commercial hobby project. Using it costs nothing and it contains no advertising.',
      ],
    },
    {
      heading: '2. The service',
      blocks: [
        'In SpotOn you can discover and share places (spots) on a map, upload photos, write reviews, save favourites, follow and search for other users, and earn experience points (XP) and levels for your contributions. Submitted spots, changes to approved spots and photos added to other people\'s spots appear for everyone after an admin approves them. The content and features of the service may change.',
        'Profile. Every user has a profile page (username, profile picture, level, bio, the numbers of followers and followed users, approved spots). You can make your profile private: then only followers you accept see the list of your spots on your profile, while your spots stay visible to everyone on the map. You can remove your followers at any time.',
      ],
    },
    {
      heading: '3. Registration and account',
      blocks: [
        [
          'Only people aged 16 or over may register.',
          'One person should use one account and must not impersonate anyone else.',
          'You are responsible for your account and the security of your password. If you notice unauthorised use, tell us.',
          'You can delete your account at any time in Settings.',
        ],
      ],
    },
    {
      heading: '4. Content you upload',
      blocks: [
        'You are responsible for the spots, descriptions, photos, reviews and bio you upload. Upload only what you have the right to: your own photos, or ones you have permission to use.',
        'It is forbidden to upload:',
        [
          'unlawful, offensive, hateful, violent or sexual content;',
          'other people\'s personal data, or a photo in which another person is recognisable, without their consent;',
          'a spot that identifies another person\'s home, without their consent;',
          'private property, closed-off or life-threatening places, where visiting the place is unlawful or dangerous;',
          'advertising, unsolicited messages, false or misleading information;',
          'content that infringes someone else\'s copyright or other rights.',
        ],
        'You are responsible for the consent of the people shown in your photos (section 2:48 of the Hungarian Civil Code).',
        'By uploading, you grant the provider a free, non-exclusive licence, unlimited in time and territory, to reproduce the content within SpotOn (store it, including with hosting and infrastructure providers), to communicate it to the public (make it available on demand), and to adapt it as far as needed for operation (resizing, compression). The licence survives the deletion of your account for the spots and photos that remain after deletion; these are then shown without naming the author, which you agree to. We also remove such content on request. Your reviews and the photos you added to other people\'s spots are deleted with your account (details in the Privacy Policy).',
      ],
    },
    {
      heading: '5. Moderation',
      blocks: [
        'The provider and the admins may approve submitted spots, changes and photos or reject them with a reason, and may delete content that breaches these terms without prior notice, with a reason. You can fix and resubmit a rejected spot. For repeated or serious breaches the account may be suspended or deleted. We notify you of a rejection, the removal of content or the suspension of your account – unless the law forbids it – with the reason, in the app\'s notification centre and as a push notification; the notice stays in the notification centre until you clear it. You can object to the decision at {email}; the objection is reviewed by a person within 30 days. If you see unlawful content, report it through the feedback feature or by e-mail.',
      ],
    },
    {
      heading: '6. Visiting spots',
      blocks: [
        'Spot data is provided by users; we neither check nor guarantee its accuracy. You visit spots at your own risk. Respect private property, traffic, nature-conservation and local rules, and take care of your own and others\' safety.',
      ],
    },
    {
      heading: '7. Liability',
      blocks: [
        'The service is provided "as is", free of charge; we do not guarantee continuous availability or freedom from errors, and we may change the features. We announce the discontinuation of the service at least 30 days in advance, so that you can request your data until then.',
        'The provider\'s liability for damage arising from the use of the service or from user content is excluded to the extent permitted by law. This limitation does not apply to damage caused intentionally or by gross negligence, nor to harm to human life, physical integrity or health, whether through breach of contract or otherwise, and it does not limit the rights you are entitled to by law.',
      ],
    },
    {
      heading: '8. Changes to the terms',
      blocks: [
        'We may change these terms. We announce a material change by e-mail (and in the app) at least 15 days before it takes effect. If you do not agree, you can delete your account until then; if you keep using the service afterwards, you accept the change.',
      ],
    },
    {
      heading: '9. Governing law and contact',
      blocks: [
        'These terms are governed by Hungarian law; they do not limit the rights you are entitled to by law (including consumer rights, where applicable). You can reach us with questions at {email}.',
      ],
    },
  ],
};
