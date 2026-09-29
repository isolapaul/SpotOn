import type { LegalDocument } from './types';

// Felhasználási feltételek (ÁSZF) egy ingyenes, nem kereskedelmi hobbiszolgáltatáshoz.
export const TERMS_HU: LegalDocument = {
  title: 'Felhasználási feltételek (ÁSZF)',
  updated: 'Utolsó módosítás: 2026. szeptember 29.',
  intro: [
    'Ezek a feltételek a SpotOn (https://spoton.isolapaul.hu) használatára vonatkoznak. A személyes adataid kezeléséről az Adatvédelmi tájékoztató szól.',
    'A feltételeket a regisztráció előtt megismerheted: a bejelentkezési ablakból ez az oldal és az Adatvédelmi tájékoztató is elérhető. A regisztrációval vagy bejelentkezéssel fogadod el őket; a korábban regisztrált felhasználók az alkalmazásban, az Elfogadom gombbal fogadják el. Az elfogadás időpontját és a feltételek akkori változatát rögzítjük.',
    'A szerződés magyar nyelven, elektronikus formában jön létre; külön nem iktatjuk, a mindenkori feltételek ezen az oldalon érhetők el. Az adatbeviteli hibákat a regisztráció elküldése előtt javíthatod.',
  ],
  sections: [
    {
      heading: '1. A szolgáltató',
      blocks: [
        ['Üzemeltető: {controller} (magánszemély)', 'E-mail: {email}'],
        'A SpotOn ingyenes, nem kereskedelmi hobbiprojekt. A használatáért nem kell fizetni, és nincs benne reklám.',
      ],
    },
    {
      heading: '2. A szolgáltatás',
      blocks: [
        'A SpotOnban térképen fedezhetsz fel és oszthatsz meg helyeket (spotokat), fotókat tölthetsz fel, értékelhetsz, kedvenceket menthetsz és szinteket érhetsz el. A beküldött helyek egy admin jóváhagyása után jelennek meg mindenkinek. A szolgáltatás tartalma és funkciói változhatnak.',
      ],
    },
    {
      heading: '3. Regisztráció és fiók',
      blocks: [
        [
          'Regisztrálni csak 16. életévét betöltött személy tud.',
          'Egy személy egy fiókot használjon, és ne adja ki magát másnak.',
          'A fiókodért és a jelszavad biztonságáért te felelsz. Ha illetéktelen használatot észlelsz, jelezd nekünk.',
          'A fiókodat bármikor törölheted a Beállításokban.',
        ],
      ],
    },
    {
      heading: '4. Az általad feltöltött tartalom',
      blocks: [
        'A feltöltött helyekért, leírásokért, fotókért és értékelésekért te felelsz. Csak olyat tölts fel, amihez jogod van: saját fotót, vagy olyat, amelynek a felhasználására engedélyt kaptál.',
        'Tilos feltölteni:',
        [
          'jogszabálysértő, sértő, gyűlöletkeltő, erőszakos vagy szexuális tartalmat;',
          'más személyes adatait, vagy olyan fotót, amelyen más ember felismerhető, az ő hozzájárulása nélkül;',
          'olyan helyet, amely más ember lakóhelyét azonosítja, az ő hozzájárulása nélkül;',
          'magánterületet, lezárt vagy életveszélyes helyet, ha a helyszín felkeresése jogsértő vagy veszélyes;',
          'reklámot, kéretlen üzenetet, hamis vagy megtévesztő adatot;',
          'más szerzői jogát vagy egyéb jogát sértő tartalmat.',
        ],
        'A fotókon szereplő személyek hozzájárulásáért (Ptk. 2:48. §) te felelsz.',
        'A feltöltéssel ingyenes, nem kizárólagos, időben és területileg nem korlátozott felhasználási engedélyt adsz a szolgáltatónak arra, hogy a tartalmat a SpotOn keretében többszörözze (tárolja, beleértve a tárhely- és infrastruktúra-szolgáltatóknál), nyilvánossághoz közvetítse (lehívásra hozzáférhetővé tegye), és a működéshez szükséges mértékben átdolgozza (méretezés, tömörítés). Az engedély a fiókod törlése után is fennmarad azokra a helyekre és fotókra, amelyek a törlés után megmaradnak; ezeket ekkor szerzői név feltüntetése nélkül jelenítjük meg, amihez hozzájárulsz. Kérésre az ilyen tartalmat is eltávolítjuk. Az értékeléseid és a mások helyeihez feltöltött fotóid a fiók törlésekor törlődnek (részletek az Adatvédelmi tájékoztatóban).',
      ],
    },
    {
      heading: '5. Moderálás',
      blocks: [
        'A szolgáltató és az adminok a beküldött helyeket jóváhagyhatják vagy elutasíthatják, és a feltételeket sértő tartalmat előzetes értesítés nélkül törölhetik. Ismételt vagy súlyos szabálysértés esetén a fiókot felfüggeszthetjük vagy törölhetjük. A tartalom eltávolításáról vagy a fiók felfüggesztéséről – ha nem jogszabály tiltja – e-mailben, indokolással értesítünk. A döntés ellen a(z) {email} címen kifogást tehetsz, amelyet emberi felülvizsgálattal 30 napon belül elbírálunk. Ha jogsértő tartalmat látsz, jelezd a visszajelzés funkcióval vagy e-mailben.',
      ],
    },
    {
      heading: '6. A helyek felkeresése',
      blocks: [
        'A helyek adatait felhasználók adják meg; pontosságukat nem ellenőrizzük és nem garantáljuk. A helyeket saját felelősségedre keresed fel. Tartsd tiszteletben a magántulajdont, a közlekedési, természetvédelmi és helyi szabályokat, és ügyelj a saját és mások biztonságára.',
      ],
    },
    {
      heading: '7. Felelősség',
      blocks: [
        'A szolgáltatást „ahogy van” alapon, ingyenesen nyújtjuk; a folyamatos elérhetőséget és a hibamentességet nem garantáljuk, és a funkciókat módosíthatjuk. A szolgáltatás megszüntetéséről legalább 30 nappal előre értesítünk, hogy addig kérhesd az adataid kiadását.',
        'A szolgáltató felelőssége a szolgáltatás használatából vagy a felhasználói tartalomból eredő károkért – a jogszabályok által megengedett mértékben – kizárt. Ez a korlátozás nem vonatkozik a szándékosan vagy súlyos gondatlansággal okozott kárra, sem az emberi életet, testi épséget vagy egészséget megkárosító károkozásra, akár szerződésszegéssel, akár azon kívül történt, és nem korlátozza a jogszabály alapján kötelezően megillető jogaidat.',
      ],
    },
    {
      heading: '8. A feltételek módosítása',
      blocks: [
        'A feltételeket módosíthatjuk. A lényeges módosításról a hatálybalépés előtt legalább 15 nappal az alkalmazásban (és e-mailben) értesítünk. Ha nem értesz egyet, a hatálybalépésig törölheted a fiókodat; ha utána is használod a szolgáltatást, azzal elfogadod a módosítást.',
      ],
    },
    {
      heading: '9. Irányadó jog és kapcsolat',
      blocks: [
        'A feltételekre a magyar jog irányadó; a téged jogszabály alapján kötelezően megillető jogokat (így a fogyasztói jogokat is, ha azok alkalmazandók) ezek a feltételek nem korlátozzák. Kérdéseiddel a {email} címen kereshetsz meg minket.',
      ],
    },
  ],
};
