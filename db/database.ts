import { Database } from 'bun:sqlite';

let db: Database | null = null;

async function init() {
	if (db) return;
	db = new Database('tarotBot.db');
	db.run(`
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
				gif_id TEXT,
				stop_button_id TEXT,
				card_option_id TEXT,
				should_reply_state INTEGER,
				user_query TEXT,
				answer_1 TEXT,
				answer_2 TEXT,
				answer_3 TEXT
    )
  `);
}

async function set(userId: string | number | bigInt.BigInteger, column: string, value: string | number) {
	const userIdString = String(userId);
	const valueString = String(value);
	if (!db) {
		console.error('Database not initialized.');
		return;
	}
	try {
		await db.run('INSERT OR IGNORE INTO users (user_id) VALUES (?)', [userIdString]);
		await db.run(`UPDATE users SET ${column} = ? WHERE user_id = ?`, [valueString, userIdString]);
	} catch (error) {
		console.error(`Error storing user ${column}:`, error);
	}
}

async function get(userId: string | number | bigInt.BigInteger, column: string): Promise<string | null> {
	const userIdString = String(userId);
	if (!db) {
		console.error('Database not initialized.');
		return null;
	}
	try {
		const row: any = await db.prepare(`SELECT ${column} FROM users WHERE user_id = ?`).get(userIdString);
		return row ? row[column] : null;
	} catch (error) {
		console.error(`Error getting user ${column}:`, error);
		return null;
	}
}

export { init, set, get };
