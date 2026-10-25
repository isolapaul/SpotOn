import type { LegalDocument } from './types';

// German translation of terms.hu.ts, cross-checked against terms.en.ts. The Hungarian text is
// authoritative; keep the three in step whenever one changes.
export const TERMS_DE: LegalDocument = {
  lang: 'de',
  title: 'Nutzungsbedingungen',
  updated: 'Zuletzt geändert: 10. Oktober 2026',
  intro: [
    'Dies ist eine deutsche Übersetzung zur besseren Verständlichkeit; maßgeblich ist die ungarische Fassung.',
    'Diese Bedingungen gelten für die Nutzung von SpotOn (https://spoton.isolapaul.hu). Wie deine personenbezogenen Daten verarbeitet werden, beschreibt die Datenschutzerklärung.',
    'Du kannst die Bedingungen vor der Registrierung lesen: Diese Seite und die Datenschutzerklärung sind im Anmeldefenster verlinkt. Du akzeptierst sie mit der Registrierung oder Anmeldung; früher registrierte Nutzer akzeptieren sie in der App mit der Schaltfläche Akzeptieren. Wir speichern den Zeitpunkt der Zustimmung und die damals gültige Fassung der Bedingungen.',
    'Der Vertrag wird in ungarischer Sprache in elektronischer Form geschlossen; er wird nicht gesondert abgelegt, die jeweils aktuellen Bedingungen stehen immer auf dieser Seite. Eingabefehler kannst du vor dem Absenden der Registrierung korrigieren.',
  ],
  sections: [
    {
      heading: '1. Anbieter',
      blocks: [
        ['Betreiber: {controller} (Privatperson)', 'E-Mail: {email}'],
        'SpotOn ist ein kostenloses, nicht kommerzielles Hobbyprojekt. Die Nutzung kostet nichts, und es enthält keine Werbung.',
      ],
    },
    {
      heading: '2. Der Dienst',
      blocks: [
        'In SpotOn kannst du Orte (Spots) auf einer Karte entdecken und teilen, Fotos hochladen, Bewertungen schreiben, Favoriten speichern, anderen Nutzern folgen und nach ihnen suchen und für deine Beiträge Erfahrungspunkte (XP) und Stufen erhalten. Eingereichte Orte, Änderungen an freigegebenen Orten und Fotos, die zu Orten anderer hinzugefügt werden, erscheinen für alle, nachdem ein Admin sie freigegeben hat. Inhalt und Funktionen des Dienstes können sich ändern.',
        'Profil. Jeder Nutzer hat eine Profilseite (Benutzername, Profilbild, Stufe, Kurzbeschreibung, die Zahl der Follower und der Personen, denen er folgt, freigegebene Orte). Du kannst dein Profil auf privat stellen: Dann sehen nur Follower, die du annimmst, die Liste deiner Orte auf deinem Profil, während deine Orte auf der Karte weiterhin für alle sichtbar bleiben. Du kannst deine Follower jederzeit entfernen.',
      ],
    },
    {
      heading: '3. Registrierung und Konto',
      blocks: [
        [
          'Registrieren dürfen sich nur Personen, die mindestens 16 Jahre alt sind.',
          'Eine Person soll ein Konto nutzen und darf sich nicht als jemand anderes ausgeben.',
          'Du bist für dein Konto und die Sicherheit deines Passworts verantwortlich. Wenn du eine unbefugte Nutzung bemerkst, teile es uns mit.',
          'Du kannst dein Konto jederzeit in den Einstellungen löschen.',
        ],
      ],
    },
    {
      heading: '4. Von dir hochgeladene Inhalte',
      blocks: [
        'Du bist für die Orte, Beschreibungen, Fotos, Bewertungen und die Kurzbeschreibung verantwortlich, die du hochlädst. Lade nur hoch, wozu du berechtigt bist: eigene Fotos oder solche, für deren Nutzung du eine Erlaubnis hast.',
        'Verboten ist das Hochladen von:',
        [
          'rechtswidrigen, beleidigenden, hasserfüllten, gewalttätigen oder sexuellen Inhalten;',
          'personenbezogenen Daten anderer oder Fotos, auf denen eine andere Person erkennbar ist, ohne deren Einwilligung;',
          'Orten, die die Wohnung einer anderen Person erkennen lassen, ohne deren Einwilligung;',
          'Privatgelände, abgesperrten oder lebensgefährlichen Orten, wenn das Aufsuchen des Ortes rechtswidrig oder gefährlich ist;',
          'Werbung, unerwünschten Nachrichten, falschen oder irreführenden Angaben;',
          'Inhalten, die das Urheberrecht oder sonstige Rechte anderer verletzen;',
          'Belästigung, Bedrohung oder Einschüchterung anderer Nutzer oder dem Auftreten in fremdem Namen.',
        ],
        'Für die Einwilligung der Personen, die auf deinen Fotos zu sehen sind (§ 2:48 des ungarischen Bürgerlichen Gesetzbuchs), bist du verantwortlich.',
        'Mit dem Hochladen räumst du dem Anbieter ein unentgeltliches, nicht ausschließliches, zeitlich und räumlich unbeschränktes Nutzungsrecht ein, den Inhalt im Rahmen von SpotOn zu vervielfältigen (zu speichern, auch bei Hosting- und Infrastrukturanbietern), öffentlich zugänglich zu machen (auf Abruf bereitzustellen) und, soweit für den Betrieb erforderlich, zu bearbeiten (Größenänderung, Komprimierung). Das Nutzungsrecht besteht nach der Löschung deines Kontos für die Orte und Fotos fort, die nach der Löschung bestehen bleiben; diese werden dann ohne Nennung des Urhebers angezeigt, womit du einverstanden bist. Auf Anfrage entfernen wir auch solche Inhalte. Deine Bewertungen und die Fotos, die du zu Orten anderer hinzugefügt hast, werden mit deinem Konto gelöscht (Einzelheiten in der Datenschutzerklärung).',
      ],
    },
    {
      heading: '5. Moderation',
      blocks: [
        'Der Anbieter und die Admins können eingereichte Orte, Änderungen und Fotos freigeben oder mit Begründung ablehnen und Inhalte, die gegen diese Bedingungen verstoßen, ohne vorherige Ankündigung mit Begründung löschen. Einen abgelehnten Ort kannst du korrigieren und erneut einreichen. Bei wiederholten oder schweren Verstößen kann das Konto gesperrt oder gelöscht werden. Über eine Ablehnung, die Entfernung von Inhalten oder die Sperrung deines Kontos informieren wir dich – sofern das Gesetz es nicht verbietet – mit Begründung in der Benachrichtigungszentrale der App und als Push-Benachrichtigung; die Mitteilung bleibt in der Benachrichtigungszentrale, bis du sie löschst. Gegen die Entscheidung kannst du unter {email} Einspruch erheben; der Einspruch wird innerhalb von 30 Tagen von einem Menschen geprüft. Für anstößige Inhalte und missbräuchliche Nutzer gilt null Toleranz. Wenn du so etwas siehst, nutze in der App Melden beim Ort, Foto, bei der Bewertung, Antwort oder dem Profil (oder schreib an {email}); du kannst einen Nutzer auch blockieren, danach seht ihr einander nicht mehr. Wir prüfen Meldungen innerhalb von 24 Stunden und entfernen bei Bedarf den Inhalt oder sperren das Konto.',
      ],
    },
    {
      heading: '6. Besuch der Orte',
      blocks: [
        'Die Angaben zu den Orten stammen von Nutzern; wir prüfen und garantieren ihre Richtigkeit nicht. Du besuchst die Orte auf eigene Verantwortung. Achte Privateigentum, Verkehrs-, Naturschutz- und örtliche Regeln und achte auf deine eigene Sicherheit und die anderer.',
      ],
    },
    {
      heading: '7. Haftung',
      blocks: [
        'Der Dienst wird „wie besehen“ und kostenlos bereitgestellt; wir garantieren weder ständige Verfügbarkeit noch Fehlerfreiheit und können die Funktionen ändern. Die Einstellung des Dienstes kündigen wir mindestens 30 Tage im Voraus an, damit du bis dahin die Herausgabe deiner Daten verlangen kannst.',
        'Die Haftung des Anbieters für Schäden aus der Nutzung des Dienstes oder aus Nutzerinhalten ist ausgeschlossen, soweit gesetzlich zulässig. Diese Beschränkung gilt weder für vorsätzlich oder grob fahrlässig verursachte Schäden noch für die Verletzung des Lebens, des Körpers oder der Gesundheit, gleich ob durch Vertragsverletzung oder auf andere Weise, und sie schränkt die dir gesetzlich zwingend zustehenden Rechte nicht ein.',
      ],
    },
    {
      heading: '8. Änderungen der Bedingungen',
      blocks: [
        'Wir können diese Bedingungen ändern. Eine wesentliche Änderung kündigen wir mindestens 15 Tage vor ihrem Inkrafttreten per E-Mail (und in der App) an. Wenn du nicht einverstanden bist, kannst du dein Konto bis dahin löschen; nutzt du den Dienst danach weiter, akzeptierst du die Änderung.',
      ],
    },
    {
      heading: '9. Anwendbares Recht und Kontakt',
      blocks: [
        'Für diese Bedingungen gilt ungarisches Recht; die dir gesetzlich zwingend zustehenden Rechte (einschließlich Verbraucherrechte, soweit anwendbar) werden durch sie nicht eingeschränkt. Bei Fragen erreichst du uns unter {email}.',
      ],
    },
  ],
};
