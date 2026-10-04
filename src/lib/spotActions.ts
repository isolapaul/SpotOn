/** A secondary action of the spot details: behind "More", or shown on its own when it is the only one. */
export type SpotOverflowAction = 'list' | 'share' | 'highlight';

export interface SpotActionContext {
  signedIn: boolean;
  /** The signed-in user created the spot. */
  isOwner: boolean;
  /** The spot's status is 'approved'. */
  approved: boolean;
}

/**
 * Who gets which secondary action, in the order the More sheet lists them: lists for a signed-in
 * user on an approved spot, share on an approved spot, highlight for the owner. (Directions and the
 * favourite heart stay in the row itself.)
 */
export function spotOverflowActions({ signedIn, isOwner, approved }: SpotActionContext): SpotOverflowAction[] {
  const actions: SpotOverflowAction[] = [];
  if (signedIn && approved) actions.push('list');
  if (approved) actions.push('share');
  if (signedIn && isOwner) actions.push('highlight');
  return actions;
}
