import { genAImodel, genAIModelWithoutInstructions } from '@app/configs/config';

export async function generateResponse(message: string, model?: 'no_instructions' | undefined) {
	const chatModel = (model === 'no_instructions' ? genAIModelWithoutInstructions : genAImodel).startChat();
	const result = await chatModel.sendMessage(message);
	return result?.response?.text();
}

export async function generateResponseFromImageBuffer(image: ArrayBuffer, message: string) {
	const result = await genAImodel.generateContent([
		{
			inlineData: {
				data: Buffer.from(image).toString('base64'),
				mimeType: 'image/jpeg',
			},
		},
		message,
	]);
	return result.response.text();
}
