import type { LegalDocument } from './types';

// Felhasználási feltételek (ÁSZF) egy ingyenes, nem kereskedelmi hobbiszolgáltatáshoz.
export const TERMS_HU: LegalDocument = {
  lang: 'hu',
  title: 'Felhasználási feltételek (ÁSZF)',
  updated: 'Utolsó módosítás: 2026. október 10.',
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
        'A SpotOnban térképen fedezhetsz fel és oszthatsz meg helyeket (spotokat), fotókat tölthetsz fel, értékelhetsz, kedvenceket menthetsz, más felhasználókat követhetsz és kereshetsz, és a hozzájárulásaidért tapasztalati pontokat (XP) és szinteket kapsz. A beküldött helyek, a jóváhagyott helyek módosításai és a mások helyeihez feltöltött fotók egy admin jóváhagyása után jelennek meg mindenkinek. A szolgáltatás tartalma és funkciói változhatnak.',
        'Profil. Minden felhasználónak van profiloldala (felhasználónév, profilkép, szint, bemutatkozás, a követők és követettek száma, a jóváhagyott helyek). A profilodat privátra állíthatod: ekkor a helyeid listáját a profilodon csak az általad elfogadott követők látják, a helyeid a térképen továbbra is mindenkinek láthatók. A követőidet bármikor eltávolíthatod.',
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
        'A feltöltött helyekért, leírásokért, fotókért, értékelésekért és a bemutatkozásodért te felelsz. Csak olyat tölts fel, amihez jogod van: saját fotót, vagy olyat, amelynek a felhasználására engedélyt kaptál.',
        'Tilos feltölteni:',
        [
          'jogszabálysértő, sértő, gyűlöletkeltő, erőszakos vagy szexuális tartalmat;',
          'más személyes adatait, vagy olyan fotót, amelyen más ember felismerhető, az ő hozzájárulása nélkül;',
          'olyan helyet, amely más ember lakóhelyét azonosítja, az ő hozzájárulása nélkül;',
          'magánterületet, lezárt vagy életveszélyes helyet, ha a helyszín felkeresése jogsértő vagy veszélyes;',
          'reklámot, kéretlen üzenetet, hamis vagy megtévesztő adatot;',
          'más szerzői jogát vagy egyéb jogát sértő tartalmat;',
          'más felhasználók zaklatását, fenyegetését, megfélemlítését, vagy más nevében való fellépést.',
        ],
        'A fotókon szereplő személyek hozzájárulásáért (Ptk. 2:48. §) te felelsz.',
        'A feltöltéssel ingyenes, nem kizárólagos, időben és területileg nem korlátozott felhasználási engedélyt adsz a szolgáltatónak arra, hogy a tartalmat a SpotOn keretében többszörözze (tárolja, beleértve a tárhely- és infrastruktúra-szolgáltatóknál), nyilvánossághoz közvetítse (lehívásra hozzáférhetővé tegye), és a működéshez szükséges mértékben átdolgozza (méretezés, tömörítés). Az engedély a fiókod törlése után is fennmarad azokra a helyekre és fotókra, amelyek a törlés után megmaradnak; ezeket ekkor szerzői név feltüntetése nélkül jelenítjük meg, amihez hozzájárulsz. Kérésre az ilyen tartalmat is eltávolítjuk. Az értékeléseid és a mások helyeihez feltöltött fotóid a fiók törlésekor törlődnek (részletek az Adatvédelmi tájékoztatóban).',
      ],
    },
    {
      heading: '5. Moderálás',
      blocks: [
        'A szolgáltató és az adminok a beküldött helyeket, a módosításokat és a fotókat jóváhagyhatják vagy indoklással elutasíthatják, és a feltételeket sértő tartalmat előzetes értesítés nélkül, indoklással törölhetik. Egy elutasított helyet javíthatsz és újra beküldhetsz. Ismételt vagy súlyos szabálysértés esetén a fiókot felfüggeszthetjük vagy törölhetjük. Az elutasításról, a tartalom eltávolításáról vagy a fiók felfüggesztéséről – ha nem jogszabály tiltja – az indoklással együtt az alkalmazás értesítési központjában és push-értesítésben értesítünk; az értesítés az értesítési központban megmarad, amíg nem törlöd. A döntés ellen a(z) {email} címen kifogást tehetsz, amelyet emberi felülvizsgálattal 30 napon belül elbírálunk. A kifogásolható tartalommal és a bántó felhasználókkal szemben zéró toleranciát alkalmazunk. Ha ilyet látsz, jelentsd az alkalmazásban a hely, fotó, értékelés, válasz vagy profil Jelentés gombjával (vagy írj a(z) {email} címre); egy felhasználót le is tilthatsz, ekkor egyikőtök sem látja a másikat. A jelentéseket 24 órán belül átnézzük, és szükség esetén eltávolítjuk a tartalmat vagy felfüggesztjük a fiókot.',
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
        'A feltételeket módosíthatjuk. A lényeges módosításról a hatálybalépés előtt legalább 15 nappal e-mailben (és az alkalmazásban) értesítünk. Ha nem értesz egyet, a hatálybalépésig törölheted a fiókodat; ha utána is használod a szolgáltatást, azzal elfogadod a módosítást.',
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
