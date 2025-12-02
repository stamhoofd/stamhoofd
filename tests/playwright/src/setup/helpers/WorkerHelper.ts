import { WorkerInfo } from "@playwright/test";
import { build } from "@stamhoofd/build-development-env";
import { TestUtils } from "@stamhoofd/test-utils";
import getPort from "get-port";
import { ApiService } from "./ApiService";
import { CaddyHelper } from "./CaddyHelper";
import { DatabaseHelper } from "./DatabaseHelper";
import { FrontendProjectName, FrontendService } from "./FrontendService";
import { PlaywrightTestUtilsHelper } from "./PlaywrightTestUtilsHelper";
import { ServiceProcess } from "./ServiceHelper";
import { WorkerData } from "./WorkerData";

class WorkerHelperInstance {
    private readonly ENVIRONMENTE_NAME = "playwright";
    private isInitialized = false;
    private didLoadDatabaseEnvironment = false;
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

    get port() {
        const result = process.env.PORT;
        if (result === undefined) {
            throw new Error("PORT is not set");
        }
        return result;
    }

    /**
     * The database environment should be loaded once before importing dependent modules such as @stamhoofd/models
     */
    loadDatabaseEnvironment() {
        console.log("Loading database environment for worker ", WorkerData.id);
        if (this.didLoadDatabaseEnvironment) {
            throw new Error("Database environment already loaded");
        }
        Object.entries({
            DB_HOST: "127.0.0.1",
            DB_USER: "root",
            DB_PASS: "root",
            DB_DATABASE: `stamhoofd-playwright-${WorkerData.id}`,
        }).forEach(([key, value]) => {
            process.env[key] = value;
        });
        this.didLoadDatabaseEnvironment = true;
    }

    /**
     * Start all the services that are needed for the tests.
     * @param workerInfo
     * @returns
     */
    async startServices(workerInfo: WorkerInfo) {
        await this.loadEnvironment();
        const workerId = workerInfo.workerIndex.toString();
        const caddyHelper = new CaddyHelper();

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
            console.log(`Start frontend service ${name} for worker ${workerId}...`);
            const service = new FrontendService(name, workerId);
            const process = await service.start();
            console.log(`Frontend service ${name} started for worker ${workerId}.`);
            frontendProcesses.push(process);
        }

        console.log(`Frontend processes started for worker ${workerId}.`);

        // configure caddy
        const allProcesses = [...frontendProcesses, apiProcess];
        await caddyHelper.configure(
            allProcesses.flatMap((s) => s.caddyConfig?.routes ?? []),
            allProcesses.flatMap((s) => s.caddyConfig?.domains ?? []),
        );
        console.log(`Caddy configured for worker ${workerId}.`);

        // wait until api is ready
        await apiProcess.wait();
        console.log(`API ready for worker ${workerId}.`);

        // clear database
        const databaseHelper = new DatabaseHelper(workerId);
        await databaseHelper.clear();
        console.log(`Database cleared for worker ${workerId}.`);

        await Promise.all(frontendProcesses.map((p) => p.wait()));
        console.log(`Frontend processes ready for worker ${workerId}.`);

        return {
            teardown: async () => {
                // kill processes
                await Promise.all(allProcesses.map((p) => p.kill?.()));
            },
        };
    }

    private async loadEnvironment() {
        if (this.isInitialized) {
            throw new Error("Already initialized");
        }

        if (!this.didLoadDatabaseEnvironment) {
            throw new Error(
                "Database environment not loaded. The database environment should be loaded before importing dependent modules such as @stamhoofd/models",
            );
        }

        if (WorkerData.isInWorkerProcess) {
            // set environment variables
            Object.entries({
                NODE_ENV: "test",
                STAMHOOFD_ENV: "playwright",
                PLAYWRIGHT_WORKER_ID: WorkerData.id,
            }).forEach(([key, value]) => {
                process.env[key] = value;
            });

            await this.setPort();
            await this.loadEnvironmentForServices();
            await this.setupTestUtils();
            this.isInitialized = true;
        }
    }

    private async setPort() {
        const port = await getPort();
        process.env.PORT = port.toString();
    }

    private async loadEnvironmentForServices() {
        const env = await this.buildApiEnvironment();
        (env as any).EXPOSE_FRONTEND_ENVIRONMENT =
            await this.buildDashboardEnvironment();
        (global as any).STAMHOOFD = env;
    }

    private async buildApiEnvironment(): Promise<BackendEnvironment> {
        return await build(this.ENVIRONMENTE_NAME, {
            backend: "api",
        });
    }

    private async buildDashboardEnvironment(): Promise<FrontendEnvironment> {
        return await build(this.ENVIRONMENTE_NAME, {
            frontend: "dashboard",
        });
    }

    private async setupTestUtils() {
        PlaywrightTestUtilsHelper.setDefaultEnvironment(STAMHOOFD);
        TestUtils.globalSetup(PlaywrightTestUtilsHelper);
        TestUtils.setup();
    }

    async clearDatabase() {
        await this.databaseHelper.clear();
    }
}

export const WorkerHelper = new WorkerHelperInstance();
