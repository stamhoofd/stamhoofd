import type { Replacement } from '../endpoints/EmailRequest.js';

export function filterReplacements<T extends { id: string }>(list: T[], replacements: Replacement[]) {
    return list.filter(item => item.id === 'signInUrl' || item.id === 'unsubscribeUrl' || replacements.some(r => r.token === item.id && (r.value || r.html)));
}
