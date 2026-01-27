import { TestUtils } from '@stamhoofd/test-utils';
import { Email, InternalEmailData } from './Email.js';

type MockedCallback = (data: InternalEmailData) => Promise<void> | void;
type MockedResponse = { error?: Error | null; callback?: MockedCallback };

export class EmailMocker {
    sentEmails: InternalEmailData[] = [];
    failedEmails: InternalEmailData[] = [];

    responseQueue: MockedResponse[] = [];
    mode: 'transactional' | 'broadcast' = 'transactional';

    constructor(mode: 'transactional' | 'broadcast' = 'transactional') {
        this.mode = mode;
    }

    static transactional = new EmailMocker('transactional');
    static broadcast = new EmailMocker('broadcast');

    static infect() {
        if (STAMHOOFD.environment !== 'test') {
            throw new Error('EmailMocker can only be used in test environment');
        }

        const handler = async (mocker: EmailMocker, data: InternalEmailData) => {
            const nextHandler = mocker.responseQueue.shift();

            try {
                if (nextHandler) {
                    if (nextHandler.callback) {
                        await nextHandler.callback(data);
                    }
                    if (nextHandler.error) {
                        throw nextHandler.error;
                    }
                }
            }
            catch (e) {
                mocker.failedEmails.push(data);
                throw e;
            }

            mocker.sentEmails.push(data);

            return {
                messageId: 'mocked-' + mocker.sentEmails.length,
            };
        };

        TestUtils.addBeforeAll(async () => {
            // We load async here because this is a dev dependency (otherwise Node will reach this and complain, breaking the boot)
            const sinon = await import('sinon');

            sinon.stub(Email, 'setupIfNeeded').callsFake(function (this: typeof Email) {
                this.transporter = {
                    sendMail: async (data: InternalEmailData) => {
                        return handler(EmailMocker.broadcast, data);
                    },
                } as any;

                this.transactionalTransporter = {
                    sendMail: async (data: InternalEmailData) => {
                        return handler(EmailMocker.transactional, data);
                    },
                } as any;
            });
        });

        TestUtils.addAfterEach(() => {
            EmailMocker.afterAll();
        });
    }

    static afterAll() {
        // Clear
        EmailMocker.transactional.reset();
        EmailMocker.broadcast.reset();
    }

    reset() {
        this.sentEmails = [];
        this.failedEmails = [];
        this.responseQueue = [];
    }

    // Defining failure / success
    onNext(callback: MockedCallback) {
        this.responseQueue.push({ callback });
    }

    succeedNext() {
        this.responseQueue.push({});
    }

    failNext(error: Error) {
        this.responseQueue.push({ error });
    }

    // Helpers
    async getSucceededCount() {
        await Email.wait();
        return this.sentEmails.length;
    }

    async getFailedCount() {
        await Email.wait();
        return this.failedEmails.length;
    }

    static async getSucceededCount() {
        return await EmailMocker.transactional.getSucceededCount() + await EmailMocker.broadcast.getSucceededCount();
    }

    static async getFailedCount() {
        return await EmailMocker.transactional.getFailedCount() + await EmailMocker.broadcast.getFailedCount();
    }

    getSucceededEmail(index: number) {
        return this.sentEmails[index];
    }

    static getSucceededEmail(index: number) {
        const transactionalCount = EmailMocker.transactional.sentEmails.length;
        if (index < transactionalCount) {
            return EmailMocker.transactional.getSucceededEmail(index);
        }
        return EmailMocker.broadcast.getSucceededEmail(index - transactionalCount);
    }

    async getSucceededEmails() {
        await Email.wait();
        return this.sentEmails;
    }

    static async getSucceededEmails() {
        await Email.wait();
        return [...EmailMocker.transactional.sentEmails, ...EmailMocker.broadcast.sentEmails];
    }

    async getFailedEmails() {
        await Email.wait();
        return this.failedEmails;
    }
}
