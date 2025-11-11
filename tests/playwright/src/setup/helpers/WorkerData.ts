import { CaddyConfigHelper } from "./CaddyConfigHelper";

export type StamhoofdUrls = {
    readonly api: string;
    readonly dashboard: string;
    readonly webshop: string;
    readonly registration: string;
};

class WorkerDataInstance {
    private _id: string | undefined = process.env.TEST_WORKER_INDEX;
    private _urls: StamhoofdUrls = this.createUrls();

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

    private createUrls(): StamhoofdUrls {
        const workerId = this._id;

        if(workerId === undefined) {
            return {
                api: '',
                dashboard: '',
                webshop: '',
                registration: '',
            }
        }

        return {
            api: CaddyConfigHelper.getUrl("api", workerId),
            dashboard: CaddyConfigHelper.getUrl(
                "dashboard",
                workerId,
            ),
            webshop: CaddyConfigHelper.getUrl("webshop", workerId),
            registration: CaddyConfigHelper.getUrl(
                "registration",
                workerId,
            ),
        };
    }
}

export const WorkerData = new WorkerDataInstance();
