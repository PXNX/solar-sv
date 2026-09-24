/**
 * Operator of this deployment, shown as the controller in the privacy policy.
 * Fill these in before going live - the privacy page flags missing values.
 */
export const OPERATOR = {
	name: '',
	street: '',
	city: '',
	email: '',
	phone: ''
};

/** Date the privacy policy text was last reviewed. */
export const PRIVACY_UPDATED = new Date('2026-09-24');

export const operatorComplete = Object.values(OPERATOR)
	.slice(0, 4)
	.every((value) => value.trim() !== '');
