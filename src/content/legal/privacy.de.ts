import type { LegalDocument } from './types';

// German translation of privacy.hu.ts, cross-checked against privacy.en.ts. The Hungarian text is
// authoritative; keep the three in step (same sections, same facts) whenever one changes.
export const PRIVACY_DE: LegalDocument = {
  lang: 'de',
  title: 'Datenschutzerklärung',
  updated: 'Zuletzt geändert: 30. September 2026',
  intro: [
    'Dies ist eine deutsche Übersetzung zur besseren Verständlichkeit; maßgeblich ist die ungarische Fassung.',
    'Diese Erklärung beschreibt, welche personenbezogenen Daten SpotOn (https://spoton.isolapaul.hu) verarbeitet, warum, wie lange, wer darauf zugreifen kann und welche Rechte du hast. SpotOn ist ein kostenloses, nicht kommerzielles Hobbyprojekt, das von einer Privatperson betrieben wird.',
  ],
  sections: [
    {
      heading: '1. Verantwortlicher',
      blocks: [
        ['Name: {controller}', 'E-Mail: {email}'],
        'Fragen und Anfragen zum Datenschutz kannst du an diese E-Mail-Adresse richten. Wir sind nicht verpflichtet, einen Datenschutzbeauftragten zu benennen.',
      ],
    },
    {
      heading: '2. Welche Daten wir zu welchem Zweck und auf welcher Rechtsgrundlage verarbeiten',
      blocks: [
        'Für die Registrierung sind eine E-Mail-Adresse (oder ein Google-Konto) und ein Benutzername erforderlich; ohne sie kannst du kein Konto anlegen. Alle anderen Angaben (Profilbild, Kurzbeschreibung, Orte, Bewertungen, Follows, Benachrichtigungen, Standort, Feedback) sind freiwillig; wenn du sie nicht machst, kannst du die jeweilige Funktion nicht nutzen.',
        'Konto und Profil. Deine E-Mail-Adresse, deine Firebase-ID, dein Benutzername, bei der Anmeldung mit Google der Name deines Google-Kontos und die Adresse seines Profilbilds, die von dir gewählte Namensfarbe, Schriftart und das Pin-Symbol, deine Kurzbeschreibung (höchstens 150 Zeichen), ob dein Profil öffentlich oder privat ist und ob es deine gespeicherten Orte zeigt, deine Sprache, die Zahl deiner hochgeladenen Orte, deine Erfahrungspunkte (XP) und deine Stufe sowie wann und welche Fassung der Nutzungsbedingungen und dieser Erklärung du akzeptiert hast. Zweck: Anlegen des Kontos, Anmeldung und Anzeige des Profils. Rechtsgrundlage: Erbringung des Dienstes nach den Nutzungsbedingungen, also Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO). Speicherdauer: bis zur Löschung des Kontos. Inaktive Konten werden nicht automatisch gelöscht.',
        'Profil- und Titelbild. Die von dir hochgeladenen Bilder. Rechtsgrundlage und Speicherdauer wie beim Konto.',
        'Stufen. XP und Stufe berechnet der Server aus deinen freigegebenen Orten, deinen freigegebenen Fotos und deinen Bewertungen der Orte anderer; wird davon etwas gelöscht, entfallen auch die zugehörigen XP, deine Stufe sinkt aber nie unter die, die du im früheren, auf der Zahl der Orte beruhenden System erreicht hast. Rechtsgrundlage und Speicherdauer wie beim Konto.',
        'Einladungen. Wenn du angibst, wer dich eingeladen hat (dessen Benutzernamen oder Einladungslink), speichern wir, wer wen wann eingeladen hat und ob die eingeladene Person schon ihren ersten freigegebenen Ort geteilt hat; das sehen die beiden Beteiligten, und die einladende Person sieht die Benutzernamen derer, die über sie beigetreten sind. Die Zahl der von dir Eingeladenen ist auf deinem Profil öffentlich (Abzeichen). Eine Einladung bringt euch beiden XP. Rechtsgrundlage: Vertragserfüllung. Speicherdauer: bis zur Löschung des Kontos; löscht die einladende Person ihr Konto, behält die eingeladene Person die XP, aber nicht den Namen der einladenden Person.',
        'Aufrufe. Wenn du angemeldet die Seite eines Ortes öffnest, speichern wir, dass du ihn an diesem Tag angesehen hast (die ID des Ortes, deine Firebase-ID und den Tag), damit eine Person nur einmal am Tag gezählt wird; die Zahl der Aufrufe eines Ortes ist öffentlich, wer ihn angesehen hat, nicht. Die Inhaber von Orten können eine wöchentliche Zusammenfassung erhalten, wie oft ihre Orte angesehen wurden. Rechtsgrundlage: berechtigtes Interesse (Hervorheben beliebter Orte). Speicherdauer: die Tagesmarkierung bis zum nächsten Aufruf oder bis zur Löschung des Kontos.',
        'Ich war hier. Wenn du bei einem Ort auf „Ich war hier“ tippst, wird die aktuelle Position deines Geräts einmal an den Server gesendet, um zu prüfen, ob du in der Nähe des Ortes bist; die Position wird nicht gespeichert, nur welchen Ort du wann besucht hast. Das siehst nur du; die Zahl der Personen, die dort waren, ist öffentlich. Rechtsgrundlage: deine Einwilligung (das Tippen auf die Schaltfläche). Speicherdauer: bis zur Löschung des Kontos.',
        'Öffentliche Listen. Wenn du eine deiner Listen öffentlich machst, sind ihr Name, ihre Orte und dein Benutzername für alle in der Suche der App und im Web sichtbar (auch Suchmaschinen können sie finden), bis du sie wieder umstellst. Rechtsgrundlage: Vertragserfüllung. Speicherdauer: solange sie öffentlich ist, bzw. bis zur Löschung des Kontos.',
        'Follows. Wem du folgst, wer dir folgt, und deine noch nicht beantworteten Follow-Anfragen (wer wem wann eine geschickt hat). Die Zahl der Follower und der gefolgten Personen ist öffentlich, die Listen sind es nicht: Ein Follow ist nur für die beiden Beteiligten sichtbar. Bei einem privaten Profil sehen nur Follower, die du annimmst, die Liste deiner Orte auf deinem Profil; deine freigegebenen Orte bleiben auf der Karte trotzdem für alle sichtbar. Rechtsgrundlage: Vertragserfüllung. Speicherdauer: bis zum Ende des Follows, bis zur Beantwortung oder Rücknahme der Anfrage bzw. bis zur Löschung des Kontos.',
        'Nutzersuche. Angemeldete Nutzer können nach dem Anfang eines Benutzernamens suchen (mindestens 2 Zeichen, höchstens 10 Treffer); ein Treffer zeigt den Benutzernamen, das Profilbild, die Stufe und ob das Profil privat ist. Um Missbrauch vorzubeugen, zählen wir die Suchen jedes Nutzers (höchstens 20 pro Minute) und speichern, wann wir zuletzt jemanden über deine Follow-Anfrage benachrichtigt haben. Rechtsgrundlage: berechtigtes Interesse (Schutz des Dienstes). Speicherdauer: bis zur Löschung des Kontos.',
        'Orte (Spots). Der von dir eingegebene Name, die Kategorie und die Beschreibung, die genauen Koordinaten des Ortes, die Fotos, der Zeitpunkt des Hochladens und der Name der hochladenden Person. Freigegebene Orte sind für alle öffentlich, auch ohne Anmeldung; Orte, die auf Freigabe warten, und abgelehnte Orte sehen nur du und die Admins. Standortdaten (EXIF, z. B. GPS-Koordinaten) werden vor dem Hochladen schon auf deinem Gerät aus den Fotos entfernt. Rechtsgrundlage: Vertragserfüllung. Speicherdauer: Orte, die auf Freigabe warten, bis zur Freigabe oder Löschung; ein abgelehnter Ort wird zusammen mit der Begründung des Admins aufbewahrt, damit du ihn korrigieren und erneut einreichen kannst, bis ein Admin ihn löscht (auf Anfrage löschen wir ihn); freigegebene Orte bis zur Löschung des Kontos, danach ohne Verbindung zur hochladenden Person (siehe Abschnitt 4).',
        'Moderation. Änderungen an deinen freigegebenen Orten und Fotos, die andere zu Orten hinzufügen, erscheinen erst, nachdem ein Admin sie freigegeben hat; bis dahin speichern wir die vorgeschlagene Änderung bzw. das Foto und die Person, die es hochgeladen hat. Die Entscheidung des Admins (bei einer Ablehnung oder Löschung mit Begründung) erhältst du in der Benachrichtigungszentrale der App und als Push-Benachrichtigung; die Benachrichtigungszentrale bewahrt höchstens 50 Einträge auf, bis du sie löschst. Rechtsgrundlage: Vertragserfüllung (Moderation nach den Nutzungsbedingungen). Speicherdauer: bis zur Entscheidung, bei Benachrichtigungen bis du sie löschst oder bis zur Löschung des Kontos.',
        'Bewertungen, Fotos bei Orten anderer, Likes, Favoriten und Hervorhebungen. Bewertungen sind zusammen mit deinem Namen und Profilbild öffentlich. Rechtsgrundlage: Vertragserfüllung. Speicherdauer: bis zur Löschung des Kontos; mit dem Konto werden sie gelöscht.',
        'Push-Benachrichtigungen. Wenn du sie erlaubst, speichern wir das Benachrichtigungs-Token deines Geräts (FCM-Token), deine Benachrichtigungseinstellungen und deine Sprache, damit wir dir Benachrichtigungen senden können (zum Beispiel wenn dein Ort freigegeben oder bewertet wurde, du eine Follow-Anfrage erhalten hast oder jemand, dem du folgst, einen neuen Ort geteilt hat). Rechtsgrundlage: deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die du jederzeit in den Einstellungen oder in deinem Browser widerrufen kannst; der Widerruf berührt nicht die Rechtmäßigkeit der bisherigen Verarbeitung. Bei der Abmeldung wird das Token dieses Geräts gelöscht.',
        'Standort. Wenn du es in deinem Browser erlaubst, wird dein genauer Standort nur auf deinem Gerät verwendet: um die Karte darauf zu zentrieren und Entfernungen zu berechnen. Dein Standort wird nicht an unsere Server gesendet (außer einmal, wenn du auf „Ich war hier“ tippst, siehe oben) und nicht gespeichert; er bleibt höchstens 10 Minuten im Sitzungsspeicher des Browsers auf deinem Gerät. Rechtsgrundlage: deine Einwilligung, die du jederzeit in den Browsereinstellungen widerrufen kannst.',
        'Feedback. Der Text deiner Nachricht und die angehängten Bilder; wenn du angemeldet bist, dein Name oder Benutzername, deine Firebase-ID und (falls bestätigt) deine E-Mail-Adresse, damit wir antworten können. Die Nachricht erreicht den Verantwortlichen per E-Mail. Rechtsgrundlage: berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO): Beheben von Fehlern und Kontakt halten. Speicherdauer: bis zum Abschluss der Sache, höchstens 1 Jahr. Zum Schutz vor Überlastung wird deine IP-Adresse höchstens einige Minuten im Arbeitsspeicher des Servers gehalten und nicht gespeichert.',
        'Technische Daten. Bei jeder Anfrage sendet dein Browser deine IP-Adresse und Angaben zum Browser. Die Protokolle von Cloudflare und unseres eigenen Servers bewahren wir höchstens 1 Jahr auf. Die Protokolle der Cloud Functions können deine Firebase-ID enthalten; Google bewahrt sie standardmäßig 30 Tage auf. Firebase bewahrt die bei der Anmeldung erfassten IP-Adressen einige Wochen auf. Rechtsgrundlage: berechtigtes Interesse (Sicherheit und Betrieb des Dienstes).',
        'Anonyme Nutzungsstatistik und Fehlerberichte. Wir führen tägliche Gesamtzähler darüber, wie oft die App geöffnet wurde (je Plattform) und wie viele Registrierungen, eingereichte Orte, Bewertungen, Teilungen und Einladungen es gab; dazu wird keinerlei Kennung (Nutzer, Gerät, IP-Adresse) gespeichert. Tritt in der App ein Fehler auf, senden wir die Fehlermeldung, die betroffene Stelle im Programmcode, den Seitenpfad, die Plattform und die Version, nachdem wir E-Mail-Adressen und Kennungen daraus entfernt haben; Fehler werden zusammengefasst, mit ihrer Anzahl, gespeichert. Zweck: Verbesserung des Dienstes und Beheben von Fehlern. Rechtsgrundlage: berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO). Speicherdauer: höchstens 1 Jahr.',
        'Sicherungskopien. Wir sichern die Datenbank von Zeit zu Zeit und bewahren die Sicherungen höchstens 1 Jahr auf; gelöschte Daten verschwinden spätestens innerhalb dieser Zeit auch aus den Sicherungen. Firebase löscht die Anmeldedaten gelöschter Konten spätestens innerhalb von 180 Tagen aus den eigenen Systemen.',
      ],
    },
    {
      heading: '3. Auf deinem Gerät gespeicherte Daten (Cookies und lokaler Speicher)',
      blocks: [
        'SpotOn verwendet keine Werbe- oder Analyse-Cookies und verfolgt dich nicht auf anderen Websites. Im lokalen Speicher deines Browsers (localStorage, sessionStorage, IndexedDB) liegen nur Daten, die für den Betrieb nötig sind: der Anmeldestatus (Firebase), die gewählte Sprache, der Kartenstil, die Liste der Benachrichtigungen in der App, der Stand der Hinweise zur Installation und zu Benachrichtigungen sowie höchstens 10 Minuten lang dein Standort. Cloudflare kann aus Sicherheitsgründen ein kurzlebiges, unbedingt erforderliches Cookie setzen. Diese Daten sind für die Erbringung des Dienstes unbedingt erforderlich, daher brauchen sie nach § 155 Abs. 4 des ungarischen Gesetzes C von 2003 über die elektronische Kommunikation keine Einwilligung. Du kannst sie jederzeit in den Einstellungen deines Browsers löschen.',
      ],
    },
    {
      heading: '4. Löschen deines Kontos',
      blocks: [
        'Du kannst dein Konto jederzeit unter Profil → Einstellungen → Konto löschen löschen oder die Löschung per E-Mail verlangen. Wenn du Admin bist, bitte zuerst darum, dass dir die Admin-Rechte entzogen werden. Bei der Löschung:',
        [
          'werden dein Konto (Anmeldung), dein Profil, dein Benutzername, deine Kurzbeschreibung, dein Profil- und Titelbild, deine Benachrichtigungs-Tokens und -Einstellungen sowie die Einträge deiner Benachrichtigungszentrale gelöscht;',
          'werden deine Follows in beide Richtungen und deine Follow-Anfragen gelöscht, ebenso deine Änderungen und Fotos, die auf Freigabe warten;',
          'werden alle deine Bewertungen, die Fotos, die du zu Orten anderer hinzugefügt hast, deine Likes und deine Hervorhebungen gelöscht;',
          'bleiben die von dir hochgeladenen Orte und ihre Fotos ohne deinen Namen, dein Profilbild und deine Konto-ID auf der Community-Karte; die Fotos werden in einen nicht mit deinem Konto verbundenen Speicher verschoben. In Protokollen und Sicherungen entfällt diese Verbindung spätestens innerhalb von 1 Jahr (siehe Abschnitt 2). Wir behalten diese Orte auf Grundlage unseres berechtigten Interesses an einer vollständigen Community-Karte und am Erhalt der Bewertungen, die andere dazu geschrieben haben (Art. 6 Abs. 1 lit. f DSGVO).',
        ],
        'Wenn ein von dir hochgeladener Ort oder ein Foto nicht bleiben soll, schreib uns vor oder nach der Löschung an {email}, und wir entfernen ihn. Schreib uns bitte auch, wenn auf einem verbleibenden Foto du oder eine andere erkennbare Person zu sehen ist oder der Ort dich auf andere Weise identifiziert. Wenn ein Ort oder Foto dich betrifft, du ihn aber nicht hochgeladen hast, schreib uns ebenfalls, und wir prüfen die Entfernung.',
      ],
    },
    {
      heading: '5. Wer auf die Daten zugreifen kann',
      blocks: [
        'Auf die Daten können der Verantwortliche und die von ihm benannten Admins zugreifen, die die eingereichten Orte freigeben. Wenn du Admin bist, sehen auch die anderen Admins deine E-Mail-Adresse, deinen Benutzernamen und dein Profilbild; Admin-Rechte vergibt der Hauptadmin anhand der E-Mail-Adresse. Wir verkaufen deine Daten nicht und nutzen sie nicht für Werbung.',
        'Öffentlich (auch ohne Anmeldung sichtbar): dein Benutzername, dein Profilbild, deine Namensfarbe, Schriftart und dein Pin-Symbol, deine Kurzbeschreibung, deine Stufe und deine XP, die Zahl deiner Follower und der Personen, denen du folgst, ob dein Profil privat ist, ob du Admin bist, freigegebene Orte mit dem Namen und Profilbild der hochladenden Person sowie Bewertungen mit deinem Namen und Profilbild. Bei einem öffentlichen Profil werden die Liste deiner freigegebenen Orte und, wenn du es eingeschaltet hast, deine gespeicherten Orte auf deinem Profil angezeigt.',
        'Die folgenden Anbieter können Daten als Auftragsverarbeiter oder als eigenständige Anbieter verarbeiten:',
        [
          'Google Ireland Ltd. und Google LLC (Firebase: Anmeldung, Datenbank, Dateispeicher, Cloud Functions, Push-Benachrichtigungen). Datenbank, Dateispeicher und Cloud Functions befinden sich in der Europäischen Union: die Datenbank in Belgien und den Niederlanden (eur3), hochgeladene Bilder in den Niederlanden und Finnland (EUR4), die Cloud Functions laufen in Frankfurt. Der Anmeldedienst und die Zustellung von Benachrichtigungen können Daten auch außerhalb der EU verarbeiten. Google-Profilbilder werden von Googles Servern geladen, daher sieht Google die IP-Adresse derjenigen, die sie anzeigen.',
          'Browserhersteller: Benachrichtigungen werden über den Push-Dienst des Herstellers deines Browsers (z. B. Google, Mozilla, Apple, Microsoft) auf dein Gerät zugestellt.',
          'Google (Gmail): Feedback geht in einem Gmail-Konto ein; Google kann die Daten als E-Mail-Anbieter auch eigenständig verarbeiten (Google Ireland Ltd.).',
          'Cloudflare, Inc.: Der Verkehr zur Website läuft über das Netzwerk von Cloudflare (IP-Adresse, Anfragedaten).',
          'Kartenanbieter: Mapbox, Inc. (USA). Beim Laden der Karte sendet dein Browser deine IP-Adresse, Angaben zum Browser und den angesehenen Kartenausschnitt direkt an Mapbox, das außerdem das Laden der Karte als anonyme Nutzungsdaten zählt (zur Abrechnung). Die Karte beruht auf Daten von Mapbox und den OpenStreetMap-Mitwirkenden. Zweck: Anzeige der Karte; Rechtsgrundlage: unser berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO). Die weitere Verarbeitung durch Mapbox regelt dessen eigene Datenschutzerklärung (mapbox.com/legal/privacy).',
          'Der Server der App läuft auf dem eigenen Server des Verantwortlichen in Ungarn.',
        ],
        'Übermittlungen außerhalb der EU (in die USA) erfolgen auf Grundlage des EU-US-Datenschutzrahmens (Angemessenheitsbeschluss (EU) 2023/1795 der Kommission) oder der von der Kommission erlassenen Standardvertragsklauseln. Diese sind in den Auftragsverarbeitungsbedingungen der Anbieter abrufbar (Firebase: firebase.google.com/terms/data-processing-terms; Cloudflare: cloudflare.com/cloudflare-customer-dpa; Mapbox: mapbox.com/legal/dpa); auf Anfrage senden wir eine Kopie.',
      ],
    },
    {
      heading: '6. Datensicherheit',
      blocks: [
        'Der Zugriff auf die Daten wird durch Sicherheitsregeln und serverseitige Prüfungen beschränkt; die Verbindung ist immer verschlüsselt (HTTPS). Orte, die auf Freigabe warten, und abgelehnte Orte sehen nur die einreichende Person und die Admins, Follows nur die beiden Beteiligten, und deine gespeicherten Orte nur du (oder, wenn du sie zeigst, wer dein Profil sehen kann).',
      ],
    },
    {
      heading: '7. Deine Rechte',
      blocks: [
        [
          'Auskunft: Du kannst fragen, welche Daten wir über dich verarbeiten, und eine Kopie verlangen.',
          'Berichtigung: Die meisten Daten kannst du in deinem Profil selbst korrigieren, den Rest korrigieren wir auf Anfrage.',
          'Löschung: Du kannst dein Konto selbst löschen (Abschnitt 4) oder die Löschung verlangen.',
          'Einschränkung der Verarbeitung.',
          'Datenübertragbarkeit: Auf Anfrage stellen wir die von dir angegebenen Daten in einem maschinenlesbaren Format bereit.',
          'Widerruf der Einwilligung (Push-Benachrichtigungen, Standort) jederzeit.',
        ],
        'Widerspruchsrecht: Gegen Verarbeitungen, die auf berechtigtem Interesse beruhen (Feedback, technische Protokolle, der Suchzähler, nach der Kontolöschung verbleibende Orte, das Laden der Karte), kannst du jederzeit unter {email} Widerspruch einlegen. Wir verarbeiten die Daten dann nicht weiter, es sei denn, zwingende schutzwürdige Gründe oder Rechtsansprüche rechtfertigen dies. Das Ergebnis der Interessenabwägung teilen wir dir auf Anfrage mit.',
        'Wir beantworten deine Anfrage ({email}) innerhalb eines Monats; in begründeten Fällen kann sich diese Frist um zwei weitere Monate verlängern, worüber wir dich informieren. Wenn du meinst, dass wir deine Rechte verletzt haben, kannst du dich bei der ungarischen Nationalen Behörde für Datenschutz und Informationsfreiheit beschweren (NAIH, 1055 Budapest, Falk Miksa utca 9–11.; Postanschrift: 1363 Budapest, Pf. 9.; Telefon: +36 1 391 1400; E-Mail: ugyfelszolgalat@naih.hu; Website: https://naih.hu) oder ein Gericht anrufen; nach deiner Wahl kannst du die Klage auch bei dem Regionalgericht (törvényszék) deines Wohnorts oder Aufenthaltsorts erheben.',
      ],
    },
    {
      heading: '8. Altersgrenze',
      blocks: [
        'Bei SpotOn dürfen sich nur Personen registrieren, die mindestens 16 Jahre alt sind. Wir prüfen das Alter nicht; du bestätigst es bei der Registrierung. Erfahren wir, dass sich jemand unter 16 Jahren registriert hat, löschen wir das Konto; wenn du das als Elternteil bemerkst, schreib uns bitte.',
      ],
    },
    {
      heading: '9. Automatisierte Entscheidungsfindung',
      blocks: [
        'Wir treffen keine ausschließlich auf automatisierter Verarbeitung beruhenden Entscheidungen über dich und erstellen kein Profiling. Eingereichte Orte, Änderungen und Fotos werden von einem Menschen (einem Admin) freigegeben oder abgelehnt. XP und Stufe werden nach einer festen, für alle gleichen Regel berechnet (von der Stufe hängt zum Beispiel die Zahl der Hervorhebungen ab); das ist keine Entscheidung im Sinne von Art. 22 DSGVO.',
      ],
    },
    {
      heading: '10. Änderungen dieser Erklärung',
      blocks: [
        'Ändert sich diese Erklärung wesentlich, kündigen wir das vor dem Inkrafttreten in der App an. Die jeweils aktuelle Fassung steht immer auf dieser Seite.',
      ],
    },
  ],
};
