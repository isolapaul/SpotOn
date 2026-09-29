import { BadgeCheck, Palette, Sparkles, WandSparkles } from 'lucide-react';
import type { PerkIcon as PerkIconId } from '@/lib/levelTheme';

const ICONS = { name: BadgeCheck, highlight: Sparkles, icons: Palette, style: WandSparkles } as const;

/** A level perk's icon (replaces the perk emoji). */
export default function PerkIcon({ icon, className }: Readonly<{ icon: PerkIconId; className?: string }>) {
  const Icon = ICONS[icon];
  return <Icon aria-hidden="true" className={className} strokeWidth={2} />;
}
