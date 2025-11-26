import { WorkerInfo } from "@playwright/test";
import { build } from "@stamhoofd/build-development-env";
import { TestUtils } from "@stamhoofd/test-utils";
import getPort from "get-port";
import { ApiService } from "./ApiService";
import { CaddyHelper } from "./CaddyHelper";
import { DatabaseHelper } from "./DatabaseHelper";
import { FrontendProjectName, FrontendService } from "./FrontendService";
import { PlaywrightTestUtilsHelper } from "./PlaywrightTestUtilsHelper";
import { WorkerData } from "./WorkerData";

class WorkerHelperInstance {
    private readonly ENVIRONMENTE_NAME = "playwright";
    private isInitialized = false;
    private didLoadDatabaseEnvironment = false;

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
        console.log("Starting api...");
        const apiService = new ApiService(workerId);
        const apiProcess = await apiService.start();

        // start frontend services
        const frontendServiceNames: FrontendProjectName[] = [
            "dashboard",
            "registration",
            "webshop",
        ];
        const frontendServices = frontendServiceNames.map(
            (name) => new FrontendService(name, workerId),
        );

        const frontendProcesses = await Promise.all(
            frontendServices.map((service) => service.start()),
        );

        // configure caddy
        const allProcesses = [...frontendProcesses, apiProcess];
        await caddyHelper.configure(
            allProcesses.flatMap((s) => s.caddyConfig?.routes ?? []),
            allProcesses.flatMap((s) => s.caddyConfig?.domains ?? []),
        );

        // wait until api is ready
        await apiProcess.wait();

        // clear database
        const databaseHelper = new DatabaseHelper(workerId);
        await databaseHelper.clear();

        await Promise.all(frontendProcesses.map((p) => p.wait()));

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
}

export const WorkerHelper = new WorkerHelperInstance();
