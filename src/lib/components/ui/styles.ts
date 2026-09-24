// Single source of truth for the app's interactive surface styling.
// Prefer the <Button>, <IconButton> and <Badge> components. Use the helpers
// below only where a component cannot be used (e.g. a <label> file trigger).

export type ButtonVariant =
	| 'primary'
	| 'secondary'
	| 'subtle'
	| 'ghost'
	| 'danger'
	| 'success'
	| 'soft-amber'
	| 'soft-blue'
	| 'soft-red';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';
export type ButtonShape = 'default' | 'circle' | 'square';

const BUTTON_BASE =
	'btn inline-flex flex-row flex-nowrap items-center justify-center gap-2 font-medium whitespace-nowrap flinch transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral disabled:opacity-50 disabled:cursor-not-allowed';

// Flat fills, no borders, no drop shadows. Colors reference daisyUI's own
// --color-* tokens (bg-primary, text-base-content, ...) rather than literal hex.
const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
	primary:
		'bg-primary hover:brightness-110 active:brightness-90 border-0 text-primary-content focus-visible:ring-primary',
	danger:
		'bg-red-600 hover:bg-red-500 active:brightness-90 border-0 text-white focus-visible:ring-red-400',
	success:
		'bg-emerald-600 hover:bg-emerald-500 active:brightness-90 border-0 text-white focus-visible:ring-emerald-400',
	secondary:
		'bg-base-100 hover:brightness-125 active:brightness-90 border-0 text-base-content/85 hover:text-base-content focus-visible:ring-primary',
	subtle:
		'bg-base-200/70 hover:bg-base-100 active:brightness-90 border-0 text-base-content/70 hover:text-base-content focus-visible:ring-primary',
	ghost:
		'btn-ghost border-0 text-base-content/60 hover:text-base-content hover:bg-primary/10 focus-visible:ring-primary',
	'soft-amber':
		'bg-primary/12 hover:bg-primary/20 border-0 text-primary hover:brightness-110 focus-visible:ring-primary',
	'soft-blue':
		'bg-secondary/18 hover:bg-secondary/28 border-0 text-secondary-content focus-visible:ring-secondary',
	'soft-red':
		'bg-red-600/10 hover:bg-red-600/20 border-0 text-red-300 hover:text-red-200 focus-visible:ring-red-400'
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
	xs: 'btn-xs',
	sm: 'btn-sm',
	md: '',
	lg: 'btn-lg'
};

const BUTTON_SHAPES: Record<ButtonShape, string> = {
	default: 'rounded-full',
	circle: 'btn-circle',
	square: 'btn-square'
};

export interface ButtonClassOptions {
	variant?: ButtonVariant;
	size?: ButtonSize;
	shape?: ButtonShape;
	block?: boolean;
	grow?: boolean;
	class?: string;
}

export function buttonClass({
	variant = 'primary',
	size = 'md',
	shape = 'default',
	block = false,
	grow = false,
	class: className = ''
}: ButtonClassOptions = {}): string {
	return [
		BUTTON_BASE,
		BUTTON_VARIANTS[variant],
		BUTTON_SIZES[size],
		BUTTON_SHAPES[shape],
		block ? 'w-full' : '',
		grow ? 'flex-1' : '',
		className
	]
		.filter(Boolean)
		.join(' ');
}

export type BadgeTone = 'neutral' | 'blue' | 'green' | 'amber' | 'orange' | 'red';
export type BadgeSize = 'xs' | 'sm' | 'md';

// Solid fitting-color fills, no outline - badges are meant to read as
// colorful tags/signals (like the match-rate badge), not bordered outlines.
const BADGE_TONES: Record<BadgeTone, string> = {
	neutral: 'bg-base-300 text-base-content',
	blue: 'bg-secondary text-secondary-content',
	green: 'bg-success text-success-content',
	amber: 'bg-primary text-primary-content',
	orange: 'bg-orange-500 text-white',
	red: 'bg-red-500 text-white'
};

const BADGE_SIZES: Record<BadgeSize, string> = {
	xs: 'badge-xs',
	sm: 'badge-sm',
	md: ''
};

export function badgeClass({
	tone = 'neutral',
	size = 'sm',
	class: className = ''
}: { tone?: BadgeTone; size?: BadgeSize; class?: string } = {}): string {
	return [
		'badge rounded-full m-0.5 font-medium border-0',
		BADGE_TONES[tone],
		BADGE_SIZES[size],
		className
	]
		.filter(Boolean)
		.join(' ');
}
