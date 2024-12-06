import { readdir } from 'node:fs/promises';

export async function pickRandomCards(folderPath: string, numberOfcards: number): Promise<string[]> {
	const files = await readdir(folderPath, { recursive: true });
	const shuffled = files.sort(() => Math.random() - 0.5);
	return shuffled.slice(0, numberOfcards);
}

export async function readCard(path: string) {
	const file = Bun.file(path);
	return file.arrayBuffer();
}
