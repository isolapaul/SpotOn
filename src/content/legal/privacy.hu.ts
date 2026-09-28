import type { LegalDocument } from './types';

// Adatvédelmi tájékoztató (GDPR 13. cikk). Minden állítás a tényleges működést írja le
// (kód: 2026-09-28); ha az adatkezelés változik, ezt is frissíteni kell.
export const PRIVACY_HU: LegalDocument = {
  title: 'Adatvédelmi tájékoztató',
  updated: 'Utolsó módosítás: 2026. szeptember 28.',
  intro: [
    'Ez a tájékoztató elmondja, milyen személyes adatokat kezel a SpotOn (https://spoton.isolapaul.hu), miért, mennyi ideig, kik férnek hozzájuk, és milyen jogaid vannak. A SpotOn egy magánszemély által üzemeltetett, ingyenes, nem kereskedelmi hobbiprojekt.',
  ],
  sections: [
    {
      heading: '1. Az adatkezelő',
      blocks: [
        ['Név: {controller}', 'E-mail: {email}'],
        'Adatvédelmi kérdésekkel és kérésekkel ezen az e-mail címen fordulhatsz hozzánk. Adatvédelmi tisztviselő kijelölésére nem vagyunk kötelesek.',
      ],
    },
    {
      heading: '2. Milyen adatokat, milyen célból és jogalapon kezelünk',
      blocks: [
        'Fiók és profil. Az e-mail címed, a Firebase-azonosítód, a felhasználóneved, Google-bejelentkezés esetén a Google-fiókod neve és profilképének címe, a választott névszín és betűtípus, a nyelved, valamint a feltöltött helyeid száma (a szinted). Cél: a fiók létrehozása, a bejelentkezés és a profil megjelenítése. Jogalap: a felhasználási feltételek szerinti szolgáltatás nyújtása, vagyis szerződés teljesítése (GDPR 6. cikk (1) b) pont). Időtartam: a fiók törléséig.',
        'Profil- és borítókép. Az általad feltöltött képek. Jogalap és időtartam ugyanaz, mint a fióknál.',
        'Helyek (spotok). Az általad megadott név, kategória, leírás, a hely pontos földrajzi koordinátái, a fotók, a feltöltés ideje és a feltöltő neve. A jóváhagyott helyek mindenki számára nyilvánosak, bejelentkezés nélkül is; a jóváhagyásra váró helyeket csak te és az adminok látjátok. Jogalap: szerződés teljesítése. Időtartam: a fiók törléséig, utána névtelenítve (lásd a 4. pontot).',
        'Értékelések, fotók mások helyein, kedvelések, kedvencek és kiemelések. Az értékelések a neveddel és a profilképeddel együtt nyilvánosak. Jogalap: szerződés teljesítése. Időtartam: a fiók törléséig; a fiók törlésekor ezek törlődnek.',
        'Push-értesítések. Ha engedélyezed, az eszközöd értesítési azonosítóját (FCM-token), az értesítési beállításaidat és a nyelvedet tároljuk, hogy értesítést küldhessünk (például ha jóváhagyták a helyedet vagy értékelést kapott). Jogalap: a hozzájárulásod (6. cikk (1) a) pont), amelyet bármikor visszavonhatsz a Beállításokban vagy a böngésződben; a visszavonás nem érinti a korábbi adatkezelés jogszerűségét. Kijelentkezéskor az adott eszköz azonosítóját töröljük.',
        'Helymeghatározás. Ha engedélyezed a böngésződben, a pontos helyedet csak az eszközödön használjuk: a térkép középre igazításához és a távolságok kiszámításához. A helyedet nem küldjük el a szervereinknek és nem tároljuk; az eszközödön legfeljebb 10 percig marad a böngésző munkamenet-tárolójában. Jogalap: a hozzájárulásod, amelyet a böngésző beállításaiban bármikor visszavonhatsz.',
        'Visszajelzés. Az üzeneted szövege és a csatolt képek; ha be vagy jelentkezve, a neved vagy felhasználóneved, a Firebase-azonosítód és (ha hitelesített) az e-mail címed, hogy válaszolni tudjunk. Az üzenet e-mailben érkezik az adatkezelőhöz. Jogalap: jogos érdek (6. cikk (1) f) pont): a hibák javítása és a kapcsolattartás. Időtartam: az ügy lezárásáig, legfeljebb 1 évig. A túlterhelés elleni védelemhez az IP-címedet legfeljebb néhány percig a szerver memóriájában tartjuk, nem mentjük el.',
        'Technikai adatok. Minden kérésnél a böngésződ elküldi az IP-címedet és a böngésző adatait. Ezeket a lenti szolgáltatók a saját naplóikban rövid ideig kezelik. A felhőfüggvények naplói a Firebase-azonosítódat tartalmazhatják; ezeket a Google alapértelmezés szerint 30 napig őrzi. Jogalap: jogos érdek (a szolgáltatás biztonsága és működtetése).',
      ],
    },
    {
      heading: '3. Az eszközödön tárolt adatok (sütik és helyi tárolás)',
      blocks: [
        'A SpotOn nem használ reklám- vagy analitikai sütiket, és nem követ más oldalakon. A böngésződ helyi tárolójában csak a működéshez szükséges adatok vannak: a bejelentkezési állapot (Firebase), a választott nyelv, a térkép stílusa, az alkalmazáson belüli értesítések listája, a telepítési és az értesítési ajánlat állapota, valamint legfeljebb 10 percig a helyadatod. Ezek a szolgáltatás nyújtásához feltétlenül szükségesek, ezért nem kérünk hozzájuk külön hozzájárulást. A böngésződ beállításaiban bármikor törölheted őket.',
      ],
    },
    {
      heading: '4. Fiók törlése',
      blocks: [
        'A fiókodat bármikor törölheted a Profil → Beállítások → Fiók törlése menüpontban, vagy e-mailben kérheted. A törléskor:',
        [
          'törlődik a fiókod (bejelentkezés), a profilod, a felhasználóneved, a profil- és borítóképed, az értesítési azonosítóid és beállításaid;',
          'törlődik minden értékelésed, a mások helyeihez feltöltött fotóid, a kedveléseid és a kiemeléseid;',
          'az általad feltöltött helyek és azok fotói név és profilkép nélkül megmaradnak a közösségi térképen. Ezek ezután nem kapcsolhatók hozzád: a fiókod és a profilod megszűnik, a helynél csak egy többé semmihez nem köthető technikai azonosító marad.',
        ],
        'Ha egy megmaradó fotón te vagy más felismerhető személy látható, vagy a hely más módon azonosít téged, írj nekünk, és azt is töröljük. A biztonsági mentésekből a törölt adatok a mentések lejártával tűnnek el.',
      ],
    },
    {
      heading: '5. Kik férnek hozzá az adatokhoz',
      blocks: [
        'Az adatokhoz az adatkezelő és az általa kijelölt adminok férnek hozzá, akik a beküldött helyeket jóváhagyják. Adataidat nem adjuk el, és reklámcélra nem használjuk. Az alábbi szolgáltatók adatfeldolgozóként vagy önálló szolgáltatóként kezelhetnek adatokat:',
        [
          'Google Ireland Ltd. és Google LLC (Firebase: bejelentkezés, adatbázis, fájltárolás, felhőfüggvények, push-értesítések). Az adatbázis és a felhőfüggvények az Európai Unióban futnak (EU több régió, illetve Frankfurt), a fájltárolás helye: [TODO: Storage bucket helye]. A bejelentkezési szolgáltatás és az értesítések továbbítása az EU-n kívül is kezelhet adatokat. Ilyenkor a továbbítás az EU–USA adatvédelmi keretrendszer és az Európai Bizottság általános szerződési feltételei alapján történik.',
          'Google (Gmail): a visszajelzések e-mailben történő kézbesítése.',
          'Cloudflare, Inc.: a weboldal forgalma a Cloudflare hálózatán keresztül érkezik (IP-cím, kérésadatok). Az EU-n kívüli továbbítás az EU–USA adatvédelmi keretrendszer alapján történik.',
          'Térképszolgáltatók: OpenStreetMap Foundation, CARTO és Esri. A térképcsempéket a böngésződ közvetlenül tőlük tölti le, ezért látják az IP-címedet és a megnézett térképrészletet. Ezek önálló szolgáltatók, a saját adatvédelmi tájékoztatójuk szerint.',
          'Az alkalmazás szervere az adatkezelő saját, Magyarországon működő szerverén fut.',
        ],
      ],
    },
    {
      heading: '6. Adatbiztonság',
      blocks: [
        'Az adatokhoz való hozzáférést biztonsági szabályok és szerveroldali ellenőrzés korlátozza; a kapcsolat mindig titkosított (HTTPS). A jóváhagyásra váró helyeket csak a beküldő és az adminok láthatják.',
      ],
    },
    {
      heading: '7. Jogaid',
      blocks: [
        [
          'Hozzáférés: megkérdezheted, milyen adatokat kezelünk rólad, és másolatot kérhetsz.',
          'Helyesbítés: a legtöbb adatot a profilodban magad javíthatod, a többit kérésre javítjuk.',
          'Törlés: a fiókodat magad törölheted (4. pont), vagy kérheted a törlést.',
          'Az adatkezelés korlátozása.',
          'Adathordozhatóság: kérésre géppel olvasható formában kiadjuk a megadott adataidat.',
          'Tiltakozás a jogos érdeken alapuló adatkezelés ellen.',
          'A hozzájárulás visszavonása (push-értesítések, helymeghatározás) bármikor.',
        ],
        'Kérésedre legfeljebb egy hónapon belül válaszolunk ({email}). Ha úgy érzed, megsértettük a jogaidat, panaszt tehetsz a Nemzeti Adatvédelmi és Információszabadság Hatóságnál (NAIH, 1055 Budapest, Falk Miksa utca 9–11.; postacím: 1363 Budapest, Pf. 9.; e-mail: ugyfelszolgalat@naih.hu; honlap: https://naih.hu), vagy bírósághoz fordulhatsz; a pert a lakóhelyed szerinti törvényszék előtt is megindíthatod.',
      ],
    },
    {
      heading: '8. Korhatár',
      blocks: [
        'A SpotOnon csak 16. életévét betöltött személy regisztrálhat. Ha tudomásunkra jut, hogy 16 év alatti személy regisztrált, a fiókját töröljük.',
      ],
    },
    {
      heading: '9. Automatizált döntéshozatal',
      blocks: [
        'Nem hozunk rólad kizárólag automatizált döntést és nem készítünk profilt. A beküldött helyeket egy ember (admin) hagyja jóvá.',
      ],
    },
    {
      heading: '10. A tájékoztató módosítása',
      blocks: [
        'Ha a tájékoztató lényegesen változik, az alkalmazásban jelezzük. A mindenkori változat ezen az oldalon olvasható.',
      ],
    },
  ],
};
