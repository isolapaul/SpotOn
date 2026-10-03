import type { LegalDocument } from './types';

// Adatvédelmi tájékoztató (GDPR 13. cikk). Minden állítás a tényleges működést írja le
// (kód: 2026-09-30, a 2.1.0-s kiadás); ha az adatkezelés változik, ezt is frissíteni kell.
export const PRIVACY_HU: LegalDocument = {
  lang: 'hu',
  title: 'Adatvédelmi tájékoztató',
  updated: 'Utolsó módosítás: 2026. szeptember 30.',
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
        'A regisztrációhoz az e-mail cím (vagy Google-fiók) és a felhasználónév megadása szükséges; ezek nélkül nem hozhatsz létre fiókot. Minden más adat (profilkép, bemutatkozás, helyek, értékelések, követések, értesítések, helymeghatározás, visszajelzés) megadása önkéntes; ha nem adod meg, az adott funkciót nem tudod használni.',
        'Fiók és profil. Az e-mail címed, a Firebase-azonosítód, a felhasználóneved, Google-bejelentkezés esetén a Google-fiókod neve és profilképének címe, a választott névszín, betűtípus és pin-ikon, a bemutatkozásod (legfeljebb 150 karakter), az, hogy a profilod nyilvános vagy privát, és hogy a mentett helyeidet megmutatod-e rajta, a nyelved, a feltöltött helyeid száma, a tapasztalati pontjaid (XP) és a szinted, valamint az, hogy mikor és melyik változatát fogadtad el a felhasználási feltételeknek és ennek a tájékoztatónak. Cél: a fiók létrehozása, a bejelentkezés és a profil megjelenítése. Jogalap: a felhasználási feltételek szerinti szolgáltatás nyújtása, vagyis szerződés teljesítése (GDPR 6. cikk (1) b) pont). Időtartam: a fiók törléséig. Az inaktív fiókokat nem töröljük automatikusan.',
        'Profil- és borítókép. Az általad feltöltött képek. Jogalap és időtartam ugyanaz, mint a fióknál.',
        'Szintek. Az XP-t és a szintet a szerver számolja a jóváhagyott helyeidből, a jóváhagyott fotóidból és a mások helyeire írt értékeléseidből; ha ezek közül valamit törölnek, az XP-je is elvész, de a szinted nem lesz alacsonyabb annál, amit a korábbi, helyszám alapú rendszerben elértél. Jogalap és időtartam ugyanaz, mint a fióknál.',
        'Követések. Kit követsz, ki követ téged, és a még el nem bírált követési kéréseid (ki kinek és mikor küldte). A követők és a követettek száma nyilvános, a névsoruk nem: egy követést csak a két érintett fél lát. Privát profilnál a helyeid listáját csak az általad elfogadott követők látják a profilodon; a jóváhagyott helyeid a térképen ettől függetlenül mindenkinek láthatók. Jogalap: szerződés teljesítése. Időtartam: a követés megszüntetéséig, a kérés elbírálásáig vagy visszavonásáig, illetve a fiók törléséig.',
        'Felhasználók keresése. Bejelentkezett felhasználók a felhasználónév eleje alapján kereshetnek (legalább 2 karakter, legfeljebb 10 találat); a találatban a felhasználónév, a profilkép, a szint és az látszik, hogy a profil privát-e. A visszaélések megelőzésére felhasználónként számoljuk a kereséseket (percenként legfeljebb 20), és azt, hogy mikor értesítettünk utoljára valakit a követési kérésedről. Jogalap: jogos érdek (a szolgáltatás védelme). Időtartam: a fiók törléséig.',
        'Helyek (spotok). Az általad megadott név, kategória, leírás, a hely pontos földrajzi koordinátái, a fotók, a feltöltés ideje és a feltöltő neve. A jóváhagyott helyek mindenki számára nyilvánosak, bejelentkezés nélkül is; a jóváhagyásra váró és az elutasított helyeket csak te és az adminok látjátok. A fotókból feltöltés előtt, már az eszközödön eltávolítjuk a helyadatokat (EXIF, például GPS-koordináták). Jogalap: szerződés teljesítése. Időtartam: a jóváhagyásra váró helyeket a jóváhagyásig vagy a törlésükig; az elutasított helyet az admin indoklásával együtt megőrizzük, hogy javíthasd és újra beküldhesd, amíg egy admin nem törli (kérésre töröljük); a jóváhagyott helyeket a fiók törléséig, utána a feltöltőhöz nem kapcsolva (lásd a 4. pontot).',
        'Moderálás. A jóváhagyott helyeid módosítása és a mások által a helyekhez feltöltött fotók egy admin jóváhagyása után jelennek meg; addig a javasolt módosítást, illetve a fotót és a feltöltőjét tároljuk. Az admin döntését (elutasításnál vagy törlésnél az indoklással) az alkalmazás értesítési központjában és push-értesítésben kapod meg; az értesítési központban legfeljebb 50 bejegyzést őrzünk, amíg nem törlöd őket. Jogalap: szerződés teljesítése (a felhasználási feltételek szerinti moderálás). Időtartam: a döntésig, illetve az értesítéseknél a törlésükig vagy a fiók törléséig.',
        'Értékelések, fotók mások helyein, kedvelések, kedvencek és kiemelések. Az értékelések a neveddel és a profilképeddel együtt nyilvánosak. Jogalap: szerződés teljesítése. Időtartam: a fiók törléséig; a fiók törlésekor ezek törlődnek.',
        'Push-értesítések. Ha engedélyezed, az eszközöd értesítési azonosítóját (FCM-token), az értesítési beállításaidat és a nyelvedet tároljuk, hogy értesítést küldhessünk (például ha jóváhagyták a helyedet, értékelést kapott, követési kérést kaptál, vagy akit követsz, új helyet osztott meg). Jogalap: a hozzájárulásod (6. cikk (1) a) pont), amelyet bármikor visszavonhatsz a Beállításokban vagy a böngésződben; a visszavonás nem érinti a korábbi adatkezelés jogszerűségét. Kijelentkezéskor az adott eszköz azonosítóját töröljük.',
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
          'törlődik a fiókod (bejelentkezés), a profilod, a felhasználóneved, a bemutatkozásod, a profil- és borítóképed, az értesítési azonosítóid és beállításaid, az értesítési központod bejegyzései;',
          'törlődnek a követéseid mindkét irányban és a követési kéréseid, valamint a jóváhagyásra váró módosításaid és fotóid;',
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
        'Nyilvános (bejelentkezés nélkül is látható): a felhasználóneved, a profilképed, a névszíned, betűtípusod és pin-ikonod, a bemutatkozásod, a szinted és az XP-d, a követőid és követetteid száma, az, hogy a profilod privát-e, az, hogy admin vagy-e, a jóváhagyott helyek a feltöltő nevével és profilképével, valamint az értékelések a neveddel és a profilképeddel. Nyilvános profilnál a jóváhagyott helyeid listája, és ha bekapcsoltad, a mentett helyeid is látszanak a profilodon.',
        'Az alábbi szolgáltatók adatfeldolgozóként vagy önálló szolgáltatóként kezelhetnek adatokat:',
        [
          'Google Ireland Ltd. és Google LLC (Firebase: bejelentkezés, adatbázis, fájltárolás, felhőfüggvények, push-értesítések). Az adatbázis, a fájltárolás és a felhőfüggvények az Európai Unióban vannak: az adatbázis Belgiumban és Hollandiában (eur3), a feltöltött képek Hollandiában és Finnországban (EUR4), a felhőfüggvények Frankfurtban futnak. A bejelentkezési szolgáltatás és az értesítések továbbítása az EU-n kívül is kezelhet adatokat. A Google-profilképek a Google szervereiről töltődnek be, így a Google látja a megjelenítő IP-címét.',
          'Böngészőgyártók: az értesítéseket a böngésződ gyártójának push-szolgáltatása (például Google, Mozilla, Apple, Microsoft) kézbesíti az eszközödre.',
          'Google (Gmail): a visszajelzéseket egy Gmail-fiókba kapjuk; a Google e-mail-szolgáltatóként önállóan is kezelheti az adatokat (Google Ireland Ltd.).',
          'Cloudflare, Inc.: a weboldal forgalma a Cloudflare hálózatán keresztül érkezik (IP-cím, kérésadatok).',
          'Térképszolgáltató: Mapbox, Inc. (USA). A térkép betöltésekor a böngésződ az IP-címedet, a böngésző adatait és a megnézett térképrészletet közvetlenül a Mapboxnak küldi, amely ezen felül a térkép betöltéseit névtelen használati adatként számolja (az elszámoláshoz). A térkép a Mapbox és az OpenStreetMap közreműködőinek adataira épül. Cél: a térkép megjelenítése; jogalap: jogos érdekünk (6. cikk (1) f) pont). A további adatkezeléséről a Mapbox saját tájékoztatója szól (mapbox.com/legal/privacy).',
          'Az alkalmazás szervere az adatkezelő saját, Magyarországon működő szerverén fut.',
        ],
        'Az EU-n kívülre (az USA-ba) történő adattovábbítás az EU–USA adatvédelmi keret (a Bizottság (EU) 2023/1795 megfelelőségi határozata), illetve a Bizottság által elfogadott általános adatvédelmi kikötések alapján történik. Ezek a szolgáltatók adatfeldolgozási feltételeiben érhetők el (Firebase: firebase.google.com/terms/data-processing-terms; Cloudflare: cloudflare.com/cloudflare-customer-dpa; Mapbox: mapbox.com/legal/dpa); másolatot kérésre küldünk.',
      ],
    },
    {
      heading: '6. Adatbiztonság',
      blocks: [
        'Az adatokhoz való hozzáférést biztonsági szabályok és szerveroldali ellenőrzés korlátozza; a kapcsolat mindig titkosított (HTTPS). A jóváhagyásra váró és az elutasított helyeket csak a beküldő és az adminok láthatják, a követéseket csak az érintett két fél, a mentett helyeidet pedig csak te (vagy ha megmutatod, aki a profilodat láthatja).',
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
        'Tiltakozási jog: a jogos érdeken alapuló adatkezelés (visszajelzések, technikai naplók, a keresési számláló, a fiók törlése után megmaradó helyek, a térkép betöltése) ellen bármikor tiltakozhatsz a(z) {email} címen. Ilyenkor az adatot nem kezeljük tovább, kivéve, ha azt kényszerítő erejű jogos ok vagy jogi igény indokolja. Az érdekmérlegelés eredményét kérésre megismerheted.',
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
        'Nem hozunk rólad kizárólag automatizált döntést és nem készítünk profilt. A beküldött helyeket, a módosításokat és a fotókat egy ember (admin) hagyja jóvá vagy utasítja el. Az XP-t és a szintet egy rögzített, mindenkire azonos szabály számolja (a szinttől függ például a kiemelések száma); ez nem minősül a GDPR 22. cikke szerinti döntéshozatalnak.',
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
