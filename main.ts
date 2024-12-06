import { telegramClient, config } from '@app/configs/config';
import * as db from '@db/database';
import { botWorkflow } from '@app/bot/bot';

(async () => {
	await db.init();
	await telegramClient.start({ botAuthToken: config.BOT_TOKEN });
	telegramClient.addEventHandler(botWorkflow);
})();
