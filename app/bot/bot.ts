import { Api } from 'telegram';
import { generateResponse, generateResponseFromImageBuffer } from '@app/api/gemini';
import * as db from '@db/database';
import { telegramClient } from '@app/configs/config';
import { Button } from 'telegram/tl/custom/button';
import { pickRandomCards, readCard } from '@utils/helpers';

const singleCardPrompt = [[Button.inline('🌟 Выбери карту!', Buffer.from('runSingleCard'))]];
const multiCardPrompt = [[Button.inline('🧱 Разложи карты!', Buffer.from('runMultiCard'))]];
const stopButtonSingle = [[Button.inline('✋ Стоп!', Buffer.from('stopSingle'))]];
const stopButtonMulti1 = [[Button.inline('✋ Стоп!', Buffer.from('stopMulti2'))]];
const stopButtonMulti2 = [[Button.inline('✋ Стоп!', Buffer.from('stopMulti3'))]];
const stopButtonMulti3 = [[Button.inline('✋ Стоп!', Buffer.from('stopMulti4'))]];

async function cardSelector(userId: bigInt.BigInteger, selectedOption: string) {
	const [singleCard, multiCard] = await Promise.all([
		generateResponse('Generate response for user to start choosing 1 tarot card. Use magic emoji.'),
		generateResponse('Generate response for user to start choosing 3 tarot card. Use magic emoji.'),
	]);
	const messageButtons = {
		single: { message: singleCard, button: singleCardPrompt }, // lang
		multi: { message: multiCard, button: multiCardPrompt }, // lang
	};

	if (selectedOption === 'single' || selectedOption === 'multi') {
		const cardRes = await telegramClient.sendMessage(userId, {
			message: messageButtons[selectedOption].message,
			buttons: messageButtons[selectedOption].button,
		});
		await db.set(String(userId), 'card_option_id', cardRes.id);
	}
	return;
}

async function sendGif(userId: bigInt.BigInteger) {
	const sentGifMessage = await telegramClient.sendMessage(userId, {
		message: '🌭 Останови сосиську!', // lang
		file: './sasiska.gif',
	});
	await db.set(userId, 'gif_id', sentGifMessage.id);
	return sentGifMessage.id;
}

async function sendButton(userId: bigInt.BigInteger, button: Api.KeyboardButtonCallback[][]) {
	const sentStopButton = await telegramClient.sendMessage(userId, {
		message: '👇',
		buttons: button,
	});
	await db.set(userId, 'stop_button_id', sentStopButton.id);
}

async function runSingleCard(userId: bigInt.BigInteger) {
	const msgId = await db.get(userId, 'card_option_id');

	const sentGifMessage = await telegramClient.editMessage(userId, {
		message: Number(msgId),
		text: '🌭 Останови сосиську!', // lang
		file: './sasiska.gif',
	});
	const sentStopButton = await telegramClient.sendMessage(userId, {
		message: '👇',
		buttons: stopButtonSingle,
	});
	await db.set(userId, 'gif_id', sentGifMessage.id);
	await db.set(userId, 'stop_button_id', sentStopButton.id);
}

async function runMultiCard(userId: bigInt.BigInteger) {
	const msgId = await db.get(userId, 'card_option_id');
	await db.set(userId, 'should_reply_state', 1);
	const writeQuestion = await generateResponse(
		'Generate mesage for user to either ask question or type no. Use magic emogi.',
	);
	await telegramClient.editMessage(userId, {
		message: Number(msgId),
		text: writeQuestion, // lang
	});
}

async function stopSingle(userId: bigInt.BigInteger) {
	const gifId = await db.get(userId, 'gif_id');
	const stopButtonId = await db.get(userId, 'stop_button_id');
	if (!gifId || !stopButtonId) throw Error('provide ids');

	await telegramClient.deleteMessages(userId, [Number(stopButtonId)], { revoke: true });

	const card = await pickRandomCards('./cards', 1);
	const cardReading = await generateResponsesFromCards(card, 'Simple YES/NO Reading.');

	await telegramClient.editMessage(userId, {
		message: Number(gifId),
		file: `./cards/${card}`,
	});
	await telegramClient.sendMessage(userId, {
		message: cardReading[0],
	});
	await db.set(userId, 'should_reply_state', 0);
	return;
}

async function stopMulti(userId: bigInt.BigInteger, selectedOption: string) {
	const card = await pickRandomCards('./cards', 1);
	const userQuestion = await db.get(userId, 'user_query');
	if (!userQuestion) throw Error('No user question found');
	const [cardReading] = await generateResponsesFromCards(card, userQuestion);

	const gifId = await db.get(userId, 'gif_id');
	const stopButtonId = await db.get(userId, 'stop_button_id');
	if (!gifId || !stopButtonId) throw Error('provide ids');

	await telegramClient.deleteMessages(userId, [Number(stopButtonId)], { revoke: true });
	await telegramClient.editMessage(userId, {
		message: Number(gifId),
		file: `./cards/${card}`,
	});
	await telegramClient.sendMessage(userId, {
		message: cardReading,
	});

	await db.set(userId, 'should_reply_state', 0);

	if (selectedOption === 'stopMulti2') {
		await db.set(userId, 'answer_1', cardReading);
		await sendGif(userId);
		await sendButton(userId, stopButtonMulti2);
	}
	if (selectedOption === 'stopMulti3') {
		await db.set(userId, 'answer_2', cardReading);
		await sendGif(userId);
		await sendButton(userId, stopButtonMulti3);
	}
	if (selectedOption === 'stopMulti4') {
		await db.set(userId, 'answer_3', cardReading);
	}
}

async function finalize(userId: bigInt.BigInteger) {
	const [res1, res2, res3] = await Promise.all([
		db.get(userId, 'answer_1'),
		db.get(userId, 'answer_2'),
		db.get(userId, 'answer_3'),
	]);

	const [response, waitMessage] = await Promise.all([
		generateResponse(`Generate summary based on these 3 cards: \n ${res1} \n ${res2}, \n ${res3}`),
		generateResponse('Generate message for user to wait until you generate a tarot reading. Use magic emoji.'),
	]);

	const awaitMessage = await telegramClient.sendMessage(userId, {
		message: waitMessage,
	});

	await Bun.sleep(3000);
	await telegramClient.editMessage(userId, {
		message: awaitMessage.id,
		text: response,
	});
}

function isAtLeastThreeWords(userMessage: string) {
	const words = userMessage.trim().split(/\s+/).filter(Boolean);
	return words.length >= 3;
}

async function sendGreetings(userId: bigInt.BigInteger) {
	const inlineButtons = [
		[Button.inline('🃏 Да/Нет, 1 карта', Buffer.from('single'))], // lang
		[Button.inline('🎴 Вопрос, 3 карты', Buffer.from('multi'))], // lang
	];

	const [welcomeMessage, chooseGuessing] = await Promise.all([
		generateResponse('Generate welcome message to tarot bot. Use magic emoji.'),
		generateResponse(
			'Generate message for user to respond between options: (Yes/No, 1 card), (Question, 3 cards). Use magic emoji.',
		),
	]);

	await telegramClient.sendMessage(userId, {
		message: welcomeMessage, // lang
	});

	await telegramClient.sendMessage(userId, {
		message: chooseGuessing, // lang
		buttons: inlineButtons,
	});
}

async function generateResponsesFromCards(cards: string[], userQuestion?: string) {
	const cardsBuffers: ArrayBuffer[] = [];
	for (const card of cards) {
		cardsBuffers.push(await readCard(`./cards/${card}`));
	}

	const questionOrNull = userQuestion ? `User question is ${userQuestion}` : '';
	const responses = [];
	for (const buffer of cardsBuffers) {
		const response = await generateResponseFromImageBuffer(
			buffer,
			`Generate tarot reading response based on card you are reading. Use magic emoji. Answer as if you are giving this card as tarot master. ${questionOrNull}`,
		);
		responses.push(response);
	}
	return responses;
}

async function handleReply(userId: bigInt.BigInteger, text: string) {
	const shouldReply = await db.get(userId, 'should_reply_state');
	if (!shouldReply) return;

	await db.set(userId, 'user_query', text);

	const userMessage = text.normalize().trim().toLowerCase();

	if (userMessage === 'no' || userMessage === 'нет' || userMessage === 'ні') {
		await sendGif(userId);
		await sendButton(userId, stopButtonMulti1);
		await db.set(userId, 'should_reply_state', 0);
	} else if (!isAtLeastThreeWords(userMessage)) {
		const fewWordsWarning = await generateResponse(
			'Generate message that user request should be at least 3 words long. Use magic emoji.',
		);
		await telegramClient.sendMessage(userId, {
			message: fewWordsWarning, // lang
		});
		return;
	} else {
		await sendGif(userId);
		await sendButton(userId, stopButtonMulti1);
		await db.set(userId, 'should_reply_state', 0);
		return;
	}
}

// lang
/* async function handleLanguageSelection(userId: bigInt.BigInteger, selectedOption: string) {
	await db.set(userId, 'user_lang', selectedOption);
	await sendGreetings(userId);
} */

export async function botWorkflow(event: Api.TypeUpdate): Promise<void> {
	if (event instanceof Api.UpdateNewMessage || event instanceof Api.UpdateNewChannelMessage) {
		const { message } = event;

		if ('message' in message) {
			const userId = (message.peerId as any).userId.toString();
			const text = message.message.trim().normalize();

			text === '/start' ? await sendGreetings(userId) : await handleReply(userId, text);
		}
	} else if (event instanceof Api.UpdateBotCallbackQuery) {
		if (!event.data) throw Error('No event data.');
		const selectedOption = event.data.toString();
		const { userId } = event;

		switch (selectedOption) {
			case 'runSingleCard':
				await runSingleCard(userId);
				break;
			case 'runMultiCard':
				await runMultiCard(userId);
				break;
			case 'single':
			case 'multi':
				await cardSelector(userId, selectedOption);
				break;
			case 'stopSingle':
				await stopSingle(userId);
				break;
			case 'stopMulti2':
			case 'stopMulti3':
				await stopMulti(userId, selectedOption);
				break;
			case 'stopMulti4':
				await stopMulti(userId, selectedOption);
				await finalize(userId);
				break;
		}
	}
}
