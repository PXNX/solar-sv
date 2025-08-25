export function createPersistentState<T>(
	key: string,
	defaultValue: T,
	serialize: (value: T) => string = JSON.stringify,
	deserialize: (value: string) => T = JSON.parse
): [T, (value: T) => void] {
	let stored: T;
	try {
		const item = localStorage.getItem(key);
		stored = item ? deserialize(item) : defaultValue;
	} catch {
		stored = defaultValue;
	}

	const save = (value: T): void => {
		try {
			localStorage.setItem(key, serialize(value));
		} catch (error) {
			console.warn(`Could not save ${key} to localStorage:`, error);
		}
	};

	return [stored, save];
}
