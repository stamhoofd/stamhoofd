import { WorkerInfo } from "@playwright/test";
import { EmailMocker } from "@stamhoofd/email";
import { TestUtils } from "@stamhoofd/test-utils";
import { ApiService } from "./ApiService";
import { CaddyConfigHelper } from "./CaddyConfigHelper";
import { DatabaseHelper } from "./DatabaseHelper";
import { FrontendProjectName, FrontendService } from "./FrontendService";
import { ServiceProcess } from "./ServiceHelper";
import { WorkerData } from "./WorkerData";

class WorkerHelperInstance {
    private isInitialized = false;
    private _databaseHelper: DatabaseHelper | null = null;

    private get databaseHelper() {
        if (!this._databaseHelper) {
            if(!WorkerData.id) {
                throw new Error("Worker id is not set");
            }
            this._databaseHelper = new DatabaseHelper(WorkerData.id);
        }
        return this._databaseHelper;
    }

    /**
     * Start all the services that are needed for the tests.
     * @param workerInfo
     * @returns
     */
    async startServices(workerInfo: WorkerInfo) {
        const workerId = workerInfo.workerIndex.toString();

        // start api
        console.log(`Start api for worker ${workerId}...`);
        const apiService = new ApiService(workerId);
        const apiProcess = await apiService.start();
        console.log(`API started for worker ${workerId}.`);

        // start frontend services
        const frontendServiceNames: FrontendProjectName[] = [
            "dashboard",
            "registration",
            "webshop",
        ];

        const frontendProcesses: ServiceProcess[] = [];

        for(const name of frontendServiceNames) {
            const service = new FrontendService(name, workerId);
            const process = await service.start();
            frontendProcesses.push(process);
        }

        console.log(`Frontend processes built for worker ${workerId}.`);

        // configure caddy
        const allProcesses = [...frontendProcesses, apiProcess];
        console.log(`Caddy configured for worker ${workerId}.`);

        // wait until api is ready
        await apiProcess.wait();
        console.log(`API ready for worker ${workerId}.`);

        await Promise.all(frontendProcesses.map((p) => p.wait()));
        console.log(`Frontend processes ready for worker ${workerId}.`);

        return {
            teardown: async () => {
                // kill processes
                await Promise.all(allProcesses.map((p) => p.kill?.()));
            },
        };
    }

    /**
     * The playwright tests use the test environment in shared/test-utils/src/env.json, with some minor tweaks to domains and ports for multiple playwright workers
     * This method changes the defaults for this worker.
     */
    overrideDefaultEvironment() {
        if (WorkerData.id === undefined) {
            throw new Error('WorkerData.id is not set');
        }

        const config: Partial<BackendEnvironment> = {
            PORT: CaddyConfigHelper.getPort('api', WorkerData.id),
            domains: {
                dashboard: CaddyConfigHelper.getDomain('dashboard', WorkerData.id),
                registration: {
                    '': CaddyConfigHelper.getDomain('registration', WorkerData.id),
                },
                // For external links, not really used at the moment apart from documentation
                marketing: {
                    '': 'www.be.stamhoofd',
                    'BE': 'www.be.stamhoofd',
                    'NL': 'www.nl.stamhoofd',
                },
                webshop: {
                    '': CaddyConfigHelper.getDomain('webshop', WorkerData.id),
                },
                api: CaddyConfigHelper.getDomain('api', WorkerData.id),
                rendererApi: CaddyConfigHelper.getDomain('renderer', WorkerData.id),
                defaultTransactionalEmail: {
                    '': 'stamhoofd.be',
                    'NL': 'stamhoofd.nl',
                },

                defaultBroadcastEmail: {
                    '': 'stamhoofd.email',
                },

                // Todo: these don't work yet
                webshopCname: CaddyConfigHelper.getDomain('webshop', WorkerData.id),
                registrationCname: CaddyConfigHelper.getDomain('registration', WorkerData.id),
            },
            translationNamespace: 'stamhoofd',
            platformName: 'stamhoofd',
            DB_DATABASE: `stamhoofd-playwright-${WorkerData.id}`,
        };

        for (const key in config) {
            TestUtils.setPermanentEnvironment(key as keyof BackendEnvironment, config[key as keyof BackendEnvironment])
        }
    }

    /**
     * The playwright tests use the test environment in shared/test-utils/src/env.json, with some minor tweaks to domains and ports for multiple playwright workers
     */
    loadEnvironment() {
        if (this.isInitialized) {
            console.log('Environment already loaded')
            return;
        }

        if (!WorkerData.isInWorkerProcess) {
            throw new Error('Loading env not possible: not in a worker process')
        }

        if (WorkerData.isInWorkerProcess) {
            // set environment variables
            console.log('Loading environment')
            this.overrideDefaultEvironment();
            EmailMocker.infect();
            console.log('Environment has been loaded')

            this.isInitialized = true;
        }
    }

    async clearDatabase() {
        await this.databaseHelper.clear();
    }
}

export const WorkerHelper = new WorkerHelperInstance();
