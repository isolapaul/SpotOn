// Universal Links for the iOS app (apple-app-site-association). Pure: no React, Firebase or DOM.

/** The bundle ID (permanent, the same as the Android package). */
export const IOS_BUNDLE_ID = 'hu.isolapaul.spoton';

/** The links that open in the app: spots, profiles and the feed (as the Android App Links do). */
export const APP_LINK_PATHS = ['/spot/*', '/user/*', '/feed', '/i/*', '/list/*'] as const;

/** An Apple Developer Team ID (10 upper-case letters or digits), else null. */
export function parseTeamId(raw: string | undefined): string | null {
  const id = (raw ?? '').trim().toUpperCase();
  return /^[A-Z0-9]{10}$/.test(id) ? id : null;
}

/** The /.well-known/apple-app-site-association document; no apps without a configured team. */
export function buildAppleAppSite(teamId: string | null) {
  return {
    applinks: {
      details: teamId
        ? [{ appIDs: [`${teamId}.${IOS_BUNDLE_ID}`], components: APP_LINK_PATHS.map((path) => ({ '/': path })) }]
        : [],
    },
  };
}
