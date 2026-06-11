import { User } from '@stamhoofd/models';
import { CaddyConfigHelper } from '../../setup/helpers/CaddyConfigHelper.js';
import { DatabaseHelper } from '../../setup/helpers/DatabaseHelper.js';
import { UserConfigurator } from './UserConfigurator.js';
import { initMembershipOrganization } from '../../init/initMembershipOrganization.js';

export type StamhoofdUrls = {
    readonly api: string;
    readonly dashboard: string;
    readonly webshop: string;
    registration(uri: string): string;
    registrationCustomDomain(domain: string): string;
    /** Default webshop domain with a uri suffix, e.g. https://shop.stamhoofd.be/my-shop */
    webshopUri(uri: string): string;
    /** Custom webshop domain, e.g. https://tickets.domain.com[/suffix] */
    webshopCustomDomain(prefix: string, suffix?: string): string;
};

/**
 * Singleton that contains all data specific to a worker.
 * Mainly use this to get the user for a worker in tests or
 * to reset and clear the database in tests.
 */
class WorkerDataInstance {
    private _id: string | undefined = process.env.TEST_PARALLEL_INDEX ?? process.env.TEST_WORKER_INDEX;
    private _urls: StamhoofdUrls = this.createUrls();
    private _user: User | null = null;
    private _initialUser: User | null = null;
    private _databaseHelper: DatabaseHelper | null = null;
    private _lastFile: string | null = null;

    get urls() {
        return this._urls;
    }

    get id() {
        return this._id;
    }

    get number() {
        return this._id !== undefined ? parseInt(this._id) : undefined;
    }

    get isInWorkerProcess() {
        return this._id !== undefined;
    }

    get user() {
        if (this._user === null) {
            throw new Error('User is not set');
        }
        return this._user;
    }

    get databaseHelper() {
        if (!this._databaseHelper) {
            if (!WorkerData.id) {
                throw new Error('Worker id is not set');
            }
            this._databaseHelper = new DatabaseHelper(WorkerData.id);
        }
        return this._databaseHelper;
    }

    get lastFile() {
        return this._lastFile;
    }

    set lastFile(file: string | null) {
        this._lastFile = file;
    }

    get configureUser() {
        return new UserConfigurator(this.user);
    }

    private createUrls(): StamhoofdUrls {
        const workerId = this._id;

        if (workerId === undefined) {
            return {
                api: '',
                dashboard: '',
                webshop: '',
                registration: () => '',
                registrationCustomDomain: () => '',
                webshopUri: () => '',
                webshopCustomDomain: () => '',
            };
        }

        return {
            api: CaddyConfigHelper.getUrl('api', workerId),
            dashboard: CaddyConfigHelper.getUrl('dashboard', workerId),
            webshop: CaddyConfigHelper.getUrl('webshop', workerId),
            registration: (uri: string) => CaddyConfigHelper.getUrl('registration', workerId, uri + '.'),
            registrationCustomDomain: (domain: string) => CaddyConfigHelper.getRegistrationCustomDomain(domain, workerId),
            webshopUri: (uri: string) => CaddyConfigHelper.getUrl('webshop', workerId) + '/' + uri,
            webshopCustomDomain: (prefix: string, suffix?: string) => 'https://' + CaddyConfigHelper.getWebshopCustomDomain(prefix, workerId) + (suffix ? '/' + suffix : ''),
        };
    }

    /**
     * Should only be set once in the worker.
     * @param user
     * @param organization
     */
    async initLoginState({ user }: { user: User }) {
        this._user = user;

        const userCopy = await User.getByID(user.id);
        if (!userCopy) {
            throw new Error('User not found');
        }
        this._initialUser = userCopy;
    }

    private async resetUser() {
        if (this._user) {
            // restore user
            const initialUser = this._initialUser;
            if (!initialUser) {
                throw new Error('Initial user is not set');
            }
            initialUser.markAllChanged();
            await initialUser.save();
            this._user = initialUser;
        }
    }

    /**
     * Clears most of the database except for the user.
     * Does reset the user to the initial state.
     * Use this for example in the afterAll hook of a test file.
     */
    async resetDatabase() {
        // reset the database, except for the user if one
        await this.databaseHelper.reset(this._user && this._user.organizationId === null ? this._user.id : null);
        if (this._user?.organizationId) {
            this._user = null;
            this._initialUser = null;
        }
        await this.resetUser();
        await initMembershipOrganization();
    }
}

export const WorkerData = new WorkerDataInstance();
