import { Formatter } from '@stamhoofd/utility';

export function useLinkableText() {
    return function (text: string) {
        const urlRegex = /\bhttps?:\/\/[^\s<>"'`]{2,}/gi;
        const escaped = Formatter.escapeHtml(text);
        return escaped.replace(urlRegex, url => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
    };
}
