import { Email, InternalEmailData } from './Email';
import { TestUtils } from '@stamhoofd/test-utils';

type MockedCallback = (data: InternalEmailData) => Promise<void> | void;
type MockedResponse = { error?: Error | null; callback?: MockedCallback };
import sinon from 'sinon';

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
    getSucceededCount() {
        return this.sentEmails.length;
    }

    getFailedCount() {
        return this.failedEmails.length;
    }

    getSucceededEmail(index: number) {
        return this.sentEmails[index];
    }

    getSucceededEmails() {
        return this.sentEmails;
    }
}
