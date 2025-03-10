import { ReplaceText, ReplaceTextArgs } from "./ReplaceText";

export async function replaceText(args: ReplaceTextArgs) {
    const replaceText = new ReplaceText(args);
    await replaceText.start();
}
