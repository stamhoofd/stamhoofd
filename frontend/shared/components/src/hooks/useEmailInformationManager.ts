import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { SessionContext } from '@stamhoofd/networking';
import { EmailInformation } from '@stamhoofd/structures';
import { Formatter, throttle } from '@stamhoofd/utility';
import { computed, ComputedRef, onUnmounted, Ref, ref, unref, watch } from 'vue';
import { useContext, useFeatureFlag } from '.';
import { useAppContext } from '../context/appContext';
import { getInvalidEmailDescription } from '../helpers';

class EmailInformationManager {
    private static INSTANCE: EmailInformationManager | null = null;

    /**
     * null if platform scope
     * string if organization scope
     * undefined if not initialized
     */
    private organizationId: string | null | undefined = undefined;

    private readonly cache: Ref<Map<string, { emailInformation: EmailInformation; fetchedAt: number }>> = ref(new Map<string, { emailInformation: EmailInformation; fetchedAt: number }>());

    /**
     * A list of emails that have been registered but not fetched yet.
     * Is not a set because the same email can be registered in multiple components.
     * This way an email can be unregistered when one component is unmounted without unregistering it in other components.
     * Only unique emails will be fetched.
     */
    private newlyRegisteredEmails: string[] = [];
    private wasInit = false;

    /**
     * Function that fetches the newly registred emails only if the function was not called again before a timeout.
     */
    private debounceFetchNewlyRegisteredEmails: (() => void) = () => {
        console.error('Debounce function is not initialized');
    };

    constructor() {
        if (EmailInformationManager.INSTANCE !== null) {
            console.error('Can only create one instance of EmailInformationManager');
            return EmailInformationManager.INSTANCE;
        }

        EmailInformationManager.INSTANCE = this;
    }

    private reset() {
        this.organizationId = undefined;
        this.cache.value = new Map<string, { emailInformation: EmailInformation; fetchedAt: number }>();
        this.newlyRegisteredEmails = [];
        this.wasInit = false;
        this.debounceFetchNewlyRegisteredEmails = () => {
            console.error('Debounce function is not initialized');
        };
    }

    init(context: SessionContext) {
        const organizationId: string | null = context.organization ? context.organization.id : null;

        // reset if organization scope changed because the email information depends on the scope (for example changed from platform to organization)
        if (organizationId !== this.organizationId) {
            if (this.wasInit) {
                this.reset();
            }

            this.organizationId = organizationId;
        }

        if (this.wasInit === false) {
            this.wasInit = true;

            const timeoutInMs = 500;

            // create a function that fetches the newly registred emails only if the function was not called again before the timeout
            this.debounceFetchNewlyRegisteredEmails = throttle(async () => {
                if (this.newlyRegisteredEmails.length === 0 || organizationId !== this.organizationId) {
                    return;
                }

                if (this.newlyRegisteredEmails.length > 100) {
                    console.warn(`Many emails registered (${this.newlyRegisteredEmails.length}), this should be avoided!`);
                }

                const emails = Formatter.uniqueArray(this.newlyRegisteredEmails);
                this.newlyRegisteredEmails = [];

                const fetchedAt = Date.now();
                const result = await this.fetchEmailInformation(emails, context);

                if (result) {
                    result.forEach((emailInformation) => {
                        const email = emailInformation.email;
                        this.cache.value.set(email, { emailInformation, fetchedAt });
                    });
                }
            }, timeoutInMs);

            return;
        }

        this.cleanupCache();
    }

    getFromCache(email: string): EmailInformation | null {
        return this.cache.value.get(email)?.emailInformation ?? null;
    }

    registerEmail(email: string) {
        const cachedValue = this.cache.value.get(email);

        // add if no cached value or if cached value is older than 10 seconds
        if (!cachedValue || cachedValue.fetchedAt < (Date.now() - 10000)) {
            this.newlyRegisteredEmails.push(email);
            this.debounceFetchNewlyRegisteredEmails();
            return;
        }
    }

    unregisterEmail(email: string) {
        const index = this.newlyRegisteredEmails.indexOf(email);
        if (index !== -1) {
            // should only remove first occurrence (email can be registered in multiple components)
            this.newlyRegisteredEmails = this.newlyRegisteredEmails.splice(index, 1);
        }
    }

    private async fetchEmailInformation(emails: string[], context: SessionContext): Promise<EmailInformation[] | null> {
        if (emails.length === 0) {
            return [];
        }

        try {
            const response = await context.authenticatedServer.request({
                method: 'POST',
                path: '/email/check-bounces',
                body: emails,
                decoder: new ArrayDecoder(EmailInformation as Decoder<EmailInformation>),
            });
            return response.data;
        }
        catch (e) {
            console.error(e);
        }

        return null;
    }

    /**
     * Cleanup old cached values if there are many cached results.
     */
    private cleanupCache() {
        // if more than 100 cached values
        if (this.cache.value.size > 100) {
            // = 5 minutes ago
            const longTimeAgo = (Date.now() - (5 * 60000));

            for (const [email, { fetchedAt }] of this.cache.value.entries()) {
                // if fetched long time ago
                if (fetchedAt < longTimeAgo) {
                    // clear the cache
                    this.cache.value.delete(email);
                }
            }
        }
    }
}

const emailInformationManager = new EmailInformationManager();

export function useEmailInformationManager() {
    const context = useContext();

    emailInformationManager.init(context.value);

    /**
    * This method will register the email and starts a debounced fetch of all the newly registered emails since the last fetch.
    * @param email
    * @returns A ComputedRef of the email information. The value will be null at first. After the fetch the value will be set.
    */
    const subscribeForEmailInformation = (email: string | ComputedRef<string | null | undefined>): ComputedRef<EmailInformation | null> => {
        // prevent unncessary fetches
        onUnmounted(() => {
            const unreffedEmail = unref(email);
            if (unreffedEmail) {
                emailInformationManager.unregisterEmail(unreffedEmail);
            }
        });

        if (typeof email === 'string') {
            emailInformationManager.registerEmail(email);
            return computed(() => emailInformationManager.getFromCache(email));
        }

        watch(email, () => {
            if (email.value) {
                emailInformationManager.registerEmail(email.value);
            }
        }, { immediate: true });

        return computed(() => email.value ? emailInformationManager.getFromCache(email.value) : null);
    };

    return {
        /**
         * This method will register the email and starts a debounced fetch of all the newly registered emails since the last fetch.
         * @param email
         * @returns A ComputedRef of the email information. The value will be null at first. After the fetch the value will be set.
         */
        subscribeForEmailInformation,
        subscribeForEmailWarning: (email: string | ComputedRef<string | null | undefined>): ComputedRef<string | null> => {
            const emailInformation = subscribeForEmailInformation(email);
            return computed(() => {
                if (emailInformation.value) {
                    return getInvalidEmailDescription(emailInformation.value);
                }
                return null;
            });
        },
    };
}

export function useShouldShowEmailWarning(): () => boolean {
    const featureFlag = useFeatureFlag();
    const app = useAppContext();

    return () => app !== 'registration' && featureFlag('STA-673');
}
