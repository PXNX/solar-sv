import type { PanelSettings, Roof } from '$lib/solar/layout';
import { DEFAULT_CUSTOMER, type Customer } from '$lib/branding';
import { DEFAULT_ECONOMICS, type Economics } from '$lib/solar/economics';
import { createPersistentState } from '$lib/utils/storeutils';

/** Everything that belongs to one customer: who, where, and the drawn roofs. */
export interface Project {
	id: string;
	customer: Customer;
	roofs: Roof[];
	economics: Economics;
	/** Module settings at the time the project was archived, restored when reopening it. */
	settings?: PanelSettings;
	createdAt: number;
	updatedAt: number;
}

const PROJECT_KEY = 'solar-project';
const HISTORY_KEY = 'solar-history';

/** Prices carry over from the previous customer; the household itself starts fresh. */
export function newProject(previous?: Economics): Project {
	const now = Date.now();
	const economics: Economics = previous
		? {
				...previous,
				consumption: DEFAULT_ECONOMICS.consumption,
				battery: { ...previous.battery, enabled: false }
			}
		: structuredClone(DEFAULT_ECONOMICS);
	return {
		id: crypto.randomUUID(),
		customer: { ...DEFAULT_CUSTOMER },
		roofs: [],
		economics,
		createdAt: now,
		updatedAt: now
	};
}

/** Fills in fields added after a project was saved. */
export function normalizeProject(stored: Partial<Project>): Project {
	const base = newProject();
	return {
		...base,
		...stored,
		customer: { ...base.customer, ...stored.customer },
		economics: {
			...base.economics,
			...stored.economics,
			battery: { ...base.economics.battery, ...stored.economics?.battery }
		}
	};
}

export function isEmptyProject(project: Project): boolean {
	return (
		project.roofs.length === 0 && !project.customer.name.trim() && !project.customer.address.trim()
	);
}

export function persistedProject() {
	return createPersistentState<Project>(PROJECT_KEY, newProject(), JSON.stringify, (v) =>
		normalizeProject(JSON.parse(v))
	);
}

export function persistedHistory() {
	return createPersistentState<Project[]>(HISTORY_KEY, []);
}

/**
 * Moves `current` into the history (unless it is empty) and returns the updated history,
 * newest first.
 */
export function archive(history: Project[], current: Project, settings: PanelSettings): Project[] {
	if (isEmptyProject(current)) return history;
	const archived: Project = { ...current, settings, updatedAt: Date.now() };
	return [archived, ...history.filter((p) => p.id !== current.id)];
}
