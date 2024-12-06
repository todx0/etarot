declare global {
	interface ProcessEnv {
		[key: string]: string;
	}
	interface UserPeer {
		userId: string;
	}
}

export {};
