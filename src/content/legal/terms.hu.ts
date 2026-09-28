import type { LegalDocument } from './types';

// Felhasználási feltételek (ÁSZF) egy ingyenes, nem kereskedelmi hobbiszolgáltatáshoz.
export const TERMS_HU: LegalDocument = {
  title: 'Felhasználási feltételek (ÁSZF)',
  updated: 'Utolsó módosítás: 2026. szeptember 28.',
  intro: [
    'Ezek a feltételek a SpotOn (https://spoton.isolapaul.hu) használatára vonatkoznak. A regisztrációval elfogadod őket. A személyes adataid kezeléséről az Adatvédelmi tájékoztató szól.',
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
          'magánterületet, lezárt vagy életveszélyes helyet, ha a helyszín felkeresése jogsértő vagy veszélyes;',
          'reklámot, kéretlen üzenetet, hamis vagy megtévesztő adatot;',
          'más szerzői jogát vagy egyéb jogát sértő tartalmat.',
        ],
        'A feltöltéssel ingyenes, nem kizárólagos, időben és területileg nem korlátozott engedélyt adsz a szolgáltatónak arra, hogy a tartalmat a SpotOnban tárolja, megjelenítse és a működéshez szükséges módon átalakítsa (például a fotókat tömörítse). A fiókod törlése után az általad feltöltött helyek és azok fotói név nélkül megmaradhatnak; az értékeléseid és a mások helyeihez feltöltött fotóid törlődnek (részletek az Adatvédelmi tájékoztatóban).',
      ],
    },
    {
      heading: '5. Moderálás',
      blocks: [
        'A szolgáltató és az adminok a beküldött helyeket jóváhagyhatják vagy elutasíthatják, és a feltételeket sértő tartalmat előzetes értesítés nélkül törölhetik. Ismételt vagy súlyos szabálysértés esetén a fiókot felfüggeszthetjük vagy törölhetjük. Ha jogsértő tartalmat látsz, jelezd a visszajelzés funkcióval vagy e-mailben.',
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
        'A szolgáltatást „ahogy van” alapon, ingyenesen nyújtjuk; a folyamatos elérhetőséget és a hibamentességet nem garantáljuk, és a szolgáltatást bármikor módosíthatjuk vagy megszüntethetjük. A szolgáltató a jogszabályok által megengedett legnagyobb mértékben kizárja a felelősségét a szolgáltatás használatából vagy a felhasználói tartalomból eredő károkért. Ez nem vonatkozik a szándékosan vagy súlyos gondatlansággal okozott, valamint az életet, testi épséget vagy egészséget megkárosító szerződésszegésért való felelősségre.',
      ],
    },
    {
      heading: '8. A feltételek módosítása',
      blocks: [
        'A feltételeket módosíthatjuk. A lényeges változásokat az alkalmazásban jelezzük; ha a módosítás után is használod a szolgáltatást, azzal elfogadod az új feltételeket. Ha nem értesz egyet, törölheted a fiókodat.',
      ],
    },
    {
      heading: '9. Irányadó jog és kapcsolat',
      blocks: [
        'A feltételekre a magyar jog irányadó; a fogyasztóként téged megillető, kötelezően alkalmazandó jogokat ezek a feltételek nem korlátozzák. Kérdéseiddel a {email} címen kereshetsz meg minket.',
      ],
    },
  ],
};
