declare global {
	interface ProcessEnv {
		[key: string]: string;
	}
	type Lang = 'eng' | 'ukr' | 'rus';
}

export {};
