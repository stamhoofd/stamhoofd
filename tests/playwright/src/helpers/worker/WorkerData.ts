import { User } from '@stamhoofd/models';
import { CaddyConfigHelper } from '../../setup/helpers/CaddyConfigHelper';
import { DatabaseHelper } from '../../setup/helpers/DatabaseHelper';
import { UserConfigurator } from './UserConfigurator';

export type StamhoofdUrls = {
    readonly api: string;
    readonly dashboard: string;
    readonly webshop: string;
    readonly registration: string;
};

/**
 * Singleton that contains all data specific to a worker.
 * Mainly use this to get the user for a worker in tests or
 * to reset and clear the database in tests.
 */
class WorkerDataInstance {
    private _id: string | undefined = process.env.TEST_WORKER_INDEX;
    private _urls: StamhoofdUrls = this.createUrls();
    private _user: User | null = null;
    private _initialUser: User | null = null;
    private _databaseHelper: DatabaseHelper | null = null;

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
                registration: '',
            };
        }

        return {
            api: CaddyConfigHelper.getUrl('api', workerId),
            dashboard: CaddyConfigHelper.getUrl('dashboard', workerId),
            webshop: CaddyConfigHelper.getUrl('webshop', workerId),
            registration: CaddyConfigHelper.getUrl('registration', workerId),
        };
    }

    /**
     * Should only be set once in the worker.
     * @param user
     * @param organization
     */
    async _initLoginState({ user }: { user: User }) {
        if (this._user !== null) {
            throw new Error('User is already set');
        }
        this._user = user;

        const userCopy = await User.getByID(user.id);
        if (!userCopy) {
            throw new Error('User not found');
        }
        this._initialUser = userCopy;
    }

    async resetUser() {
        if (this._user) {
            // restore user
            const initialUser = this._initialUser;
            if (!initialUser) {
                throw new Error('Initial user is not set');
            }
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
        await this.databaseHelper.reset(this._user ? this._user.id : null);
        await this.resetUser();
    }

    /**
     * Clears everything in the database.
     * Use this for example in the afterAll hook of a test file.
     */
    async clearDatabase() {
        await this.databaseHelper.clear();
    }
}

export const WorkerData = new WorkerDataInstance();
