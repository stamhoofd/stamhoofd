import type { ReplaceTextArgs } from './ReplaceText.js';
import { ReplaceText } from './ReplaceText.js';

export async function replaceText(args: ReplaceTextArgs) {
    const replaceText = new ReplaceText(args);
    await replaceText.start();
}
