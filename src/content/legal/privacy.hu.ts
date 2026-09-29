import type { LegalDocument } from './types';

// Adatvédelmi tájékoztató (GDPR 13. cikk). Minden állítás a tényleges működést írja le
// (kód: 2026-09-29); ha az adatkezelés változik, ezt is frissíteni kell.
export const PRIVACY_HU: LegalDocument = {
  title: 'Adatvédelmi tájékoztató',
  updated: 'Utolsó módosítás: 2026. szeptember 29.',
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
        'A regisztrációhoz az e-mail cím (vagy Google-fiók) és a felhasználónév megadása szükséges; ezek nélkül nem hozhatsz létre fiókot. Minden más adat (profilkép, helyek, értékelések, értesítések, helymeghatározás, visszajelzés) megadása önkéntes; ha nem adod meg, az adott funkciót nem tudod használni.',
        'Fiók és profil. Az e-mail címed, a Firebase-azonosítód, a felhasználóneved, Google-bejelentkezés esetén a Google-fiókod neve és profilképének címe, a választott névszín és betűtípus, a nyelved, valamint a feltöltött helyeid száma (a szinted), valamint az, hogy mikor és melyik változatát fogadtad el a felhasználási feltételeknek és ennek a tájékoztatónak. Cél: a fiók létrehozása, a bejelentkezés és a profil megjelenítése. Jogalap: a felhasználási feltételek szerinti szolgáltatás nyújtása, vagyis szerződés teljesítése (GDPR 6. cikk (1) b) pont). Időtartam: a fiók törléséig. Az inaktív fiókokat nem töröljük automatikusan.',
        'Profil- és borítókép. Az általad feltöltött képek. Jogalap és időtartam ugyanaz, mint a fióknál.',
        'Helyek (spotok). Az általad megadott név, kategória, leírás, a hely pontos földrajzi koordinátái, a fotók, a feltöltés ideje és a feltöltő neve. A jóváhagyott helyek mindenki számára nyilvánosak, bejelentkezés nélkül is; a jóváhagyásra váró helyeket csak te és az adminok látjátok. Jogalap: szerződés teljesítése. Időtartam: a jóváhagyásra váró helyeket a jóváhagyásig vagy a törlésükig (az elutasított helyeket töröljük), a jóváhagyott helyeket a fiók törléséig, utána a feltöltőhöz nem kapcsolva (lásd a 4. pontot).',
        'Értékelések, fotók mások helyein, kedvelések, kedvencek és kiemelések. Az értékelések a neveddel és a profilképeddel együtt nyilvánosak. Jogalap: szerződés teljesítése. Időtartam: a fiók törléséig; a fiók törlésekor ezek törlődnek.',
        'Push-értesítések. Ha engedélyezed, az eszközöd értesítési azonosítóját (FCM-token), az értesítési beállításaidat és a nyelvedet tároljuk, hogy értesítést küldhessünk (például ha jóváhagyták a helyedet vagy értékelést kapott). Jogalap: a hozzájárulásod (6. cikk (1) a) pont), amelyet bármikor visszavonhatsz a Beállításokban vagy a böngésződben; a visszavonás nem érinti a korábbi adatkezelés jogszerűségét. Kijelentkezéskor az adott eszköz azonosítóját töröljük.',
        'Helymeghatározás. Ha engedélyezed a böngésződben, a pontos helyedet csak az eszközödön használjuk: a térkép középre igazításához és a távolságok kiszámításához. A helyedet nem küldjük el a szervereinknek és nem tároljuk; az eszközödön legfeljebb 10 percig marad a böngésző munkamenet-tárolójában. Jogalap: a hozzájárulásod, amelyet a böngésző beállításaiban bármikor visszavonhatsz.',
        'Visszajelzés. Az üzeneted szövege és a csatolt képek; ha be vagy jelentkezve, a neved vagy felhasználóneved, a Firebase-azonosítód és (ha hitelesített) az e-mail címed, hogy válaszolni tudjunk. Az üzenet e-mailben érkezik az adatkezelőhöz. Jogalap: jogos érdek (6. cikk (1) f) pont): a hibák javítása és a kapcsolattartás. Időtartam: az ügy lezárásáig, legfeljebb 1 évig. A túlterhelés elleni védelemhez az IP-címedet legfeljebb néhány percig a szerver memóriájában tartjuk, nem mentjük el.',
        'Technikai adatok. Minden kérésnél a böngésződ elküldi az IP-címedet és a böngésző adatait. A Cloudflare és a saját szerverünk naplóit legfeljebb 1 évig őrizzük. A felhőfüggvények naplói a Firebase-azonosítódat tartalmazhatják; ezeket a Google alapértelmezés szerint 30 napig őrzi. A Firebase a bejelentkezéskor rögzített IP-címeket néhány hétig őrzi. Jogalap: jogos érdek (a szolgáltatás biztonsága és működtetése).',
        'Biztonsági mentések. Az adatbázisról időnként mentést készítünk, és ezeket legfeljebb 1 évig őrizzük; a törölt adatok a mentésekből legkésőbb ennyi idő alatt tűnnek el. A Firebase a törölt fiókok bejelentkezési adatait a saját rendszereiből legfeljebb 180 napon belül törli.',
      ],
    },
    {
      heading: '3. Az eszközödön tárolt adatok (sütik és helyi tárolás)',
      blocks: [
        'A SpotOn nem használ reklám- vagy analitikai sütiket, és nem követ más oldalakon. A böngésződ helyi tárolójában (localStorage, sessionStorage, IndexedDB) csak a működéshez szükséges adatok vannak: a bejelentkezési állapot (Firebase), a választott nyelv, a térkép stílusa, az alkalmazáson belüli értesítések listája, a telepítési és az értesítési ajánlat állapota, valamint legfeljebb 10 percig a helyadatod. A Cloudflare biztonsági célból rövid élettartamú, feltétlenül szükséges sütit helyezhet el. Ezek a szolgáltatás nyújtásához feltétlenül szükségesek, ezért az elektronikus hírközlésről szóló 2003. évi C. törvény 155. § (4) bekezdése alapján nem kell hozzájuk hozzájárulás. A böngésződ beállításaiban bármikor törölheted őket.',
      ],
    },
    {
      heading: '4. Fiók törlése',
      blocks: [
        'A fiókodat bármikor törölheted a Profil → Beállítások → Fiók törlése menüpontban, vagy e-mailben kérheted. Ha admin vagy, előbb az admin jogod visszavonását kérd. A törléskor:',
        [
          'törlődik a fiókod (bejelentkezés), a profilod, a felhasználóneved, a profil- és borítóképed, az értesítési azonosítóid és beállításaid;',
          'törlődik minden értékelésed, a mások helyeihez feltöltött fotóid, a kedveléseid és a kiemeléseid;',
          'az általad feltöltött helyek és azok fotói a neved, a profilképed és a fiókazonosítód nélkül a közösségi térképen maradnak; a fotókat a fiókodtól független tárhelyre helyezzük át. A naplókban és a biztonsági mentésekben ez a kapcsolat legkésőbb 1 év alatt szűnik meg (lásd a 2. pontot). Ezeket a helyeket a közösségi térkép teljességéhez és a mások által hozzájuk írt értékelések megőrzéséhez fűződő jogos érdekünk alapján (6. cikk (1) f) pont) tartjuk meg.',
        ],
        'Ha nem szeretnéd, hogy egy általad feltöltött hely vagy fotó megmaradjon, a törlés előtt vagy után írj nekünk a(z) {email} címre, és eltávolítjuk. Akkor is írj, ha egy megmaradó fotón te vagy más felismerhető személy látható, vagy a hely más módon azonosít téged. Ha egy hely vagy fotó rólad szól, de nem te töltötted fel, szintén írj nekünk, és megvizsgáljuk az eltávolítást.',
      ],
    },
    {
      heading: '5. Kik férnek hozzá az adatokhoz',
      blocks: [
        'Az adatokhoz az adatkezelő és az általa kijelölt adminok férnek hozzá, akik a beküldött helyeket jóváhagyják. Ha admin vagy, az e-mail címedet, a felhasználónevedet és a profilképedet a többi admin is látja; admin jogot a főadmin az e-mail cím alapján ad. Adataidat nem adjuk el, és reklámcélra nem használjuk.',
        'Nyilvános (bejelentkezés nélkül is látható): a felhasználóneved, a profilképed, a névszíned és betűtípusod, a szinted (a feltöltött helyeid száma), az, hogy admin vagy-e, a jóváhagyott helyek a feltöltő nevével és profilképével, valamint az értékelések a neveddel és a profilképeddel.',
        'Az alábbi szolgáltatók adatfeldolgozóként vagy önálló szolgáltatóként kezelhetnek adatokat:',
        [
          'Google Ireland Ltd. és Google LLC (Firebase: bejelentkezés, adatbázis, fájltárolás, felhőfüggvények, push-értesítések). Az adatbázis és a felhőfüggvények az Európai Unióban futnak (EU több régió, illetve Frankfurt), a fájltárolás helye: [TODO: Storage bucket helye]. A bejelentkezési szolgáltatás és az értesítések továbbítása az EU-n kívül is kezelhet adatokat. A Google-profilképek a Google szervereiről töltődnek be, így a Google látja a megjelenítő IP-címét.',
          'Böngészőgyártók: az értesítéseket a böngésződ gyártójának push-szolgáltatása (például Google, Mozilla, Apple, Microsoft) kézbesíti az eszközödre.',
          'Google (Gmail): a visszajelzéseket egy Gmail-fiókba kapjuk; a Google e-mail-szolgáltatóként önállóan is kezelheti az adatokat (Google Ireland Ltd.).',
          'Cloudflare, Inc.: a weboldal forgalma a Cloudflare hálózatán keresztül érkezik (IP-cím, kérésadatok).',
          'Térképszolgáltatók: OpenStreetMap Foundation, CARTO és Esri, Inc. A térképcsempék betöltésekor a böngésződ az IP-címedet és a megnézett térképrészletet közvetlenül ezeknek a szolgáltatóknak küldi; ennek célja a térkép megjelenítése, jogalapja jogos érdekünk (6. cikk (1) f) pont). Az Esri és a CARTO az USA-ban is kezelhet adatot. A további adatkezelésükről a saját tájékoztatójuk szól.',
          'Az alkalmazás szervere az adatkezelő saját, Magyarországon működő szerverén fut.',
        ],
        'Az EU-n kívülre (az USA-ba) történő adattovábbítás az EU–USA adatvédelmi keret (a Bizottság (EU) 2023/1795 megfelelőségi határozata), illetve a Bizottság által elfogadott általános adatvédelmi kikötések alapján történik. Ezek a szolgáltatók adatfeldolgozási feltételeiben érhetők el (Firebase: firebase.google.com/terms/data-processing-terms; Cloudflare: cloudflare.com/cloudflare-customer-dpa); másolatot kérésre küldünk.',
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
          'A hozzájárulás visszavonása (push-értesítések, helymeghatározás) bármikor.',
        ],
        'Tiltakozási jog: a jogos érdeken alapuló adatkezelés (visszajelzések, technikai naplók, a fiók törlése után megmaradó helyek, térképcsempék) ellen bármikor tiltakozhatsz a(z) {email} címen. Ilyenkor az adatot nem kezeljük tovább, kivéve, ha azt kényszerítő erejű jogos ok vagy jogi igény indokolja. Az érdekmérlegelés eredményét kérésre megismerheted.',
        'A kérésedre ({email}) egy hónapon belül válaszolunk; ez indokolt esetben további két hónappal meghosszabbodhat, erről értesítünk. Ha úgy érzed, megsértettük a jogaidat, panaszt tehetsz a Nemzeti Adatvédelmi és Információszabadság Hatóságnál (NAIH, 1055 Budapest, Falk Miksa utca 9–11.; postacím: 1363 Budapest, Pf. 9.; telefon: +36 1 391 1400; e-mail: ugyfelszolgalat@naih.hu; honlap: https://naih.hu), vagy bírósághoz fordulhatsz; a pert – választásod szerint – a lakóhelyed vagy a tartózkodási helyed szerinti törvényszék előtt is megindíthatod.',
      ],
    },
    {
      heading: '8. Korhatár',
      blocks: [
        'A SpotOnon csak 16. életévét betöltött személy regisztrálhat. Az életkort nem ellenőrizzük, a regisztrációkor te erősíted meg. Ha tudomásunkra jut, hogy 16 év alatti személy regisztrált, a fiókját töröljük; ha szülőként ezt tapasztalod, írj nekünk.',
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
        'Ha a tájékoztató lényegesen változik, a hatálybalépés előtt az alkalmazásban jelezzük. A mindenkori változat ezen az oldalon olvasható.',
      ],
    },
  ],
};
