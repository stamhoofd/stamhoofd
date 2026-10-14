import type { Country } from '@stamhoofd/types/Country';
import type { Language } from '@stamhoofd/types/Language';

export type LocalizationSessionChange = 'user' | 'organization' | 'platform' | 'token' | 'preventComplete';
export type LocalizationSessionListener = (changed: LocalizationSessionChange) => void;

export interface LocalizationSessionContext {
    user: { language?: Language | null; impersonatedBy?: unknown } | null;
    organization: { language?: Language | null; address: { country: Country } } | null;
    platform: { language?: Language | null };
    addListener(owner: object, listener: LocalizationSessionListener): void;
    removeListener(owner: object): void;
}
