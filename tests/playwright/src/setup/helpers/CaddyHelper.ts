import { exec as execCallback } from "node:child_process";
import { promisify } from "node:util";
import { ChildProcessHelper } from "./ChildProcessHelper";
import { ProcessInfo } from "./ProcessInfo";

const exec = promisify(execCallback);

export class CaddyHelper {
    private cadyUrl = "http://localhost:2019";
    private serverName = "stamhoofd";

    async isRunning() {
        const result = await exec(
            'pgrep -x caddy > /dev/null && echo "true" || echo "false"',
        );
        return result.stdout.trim() === "true";
    }

    async start(defaultConfig: any) {
        // Start caddy
        const childProcess = process.env.CI
            ? // Run caddy as root on CI
              ChildProcessHelper.spawnWithCleanup("sudo", ["caddy", "run"])
            : ChildProcessHelper.spawnWithCleanup("caddy", ["run"]);

        ProcessInfo.flagCaddyStarted();

        let isStarted = false;

        // wait until caddy is ready
        await new Promise<void>((resolve) => {
            // log stderr until caddy is ready
            childProcess.stderr?.on("data", (data) => {
                if (isStarted) {
                    return;
                }
                const line = data.toString();
                console.log("[Caddy] stderr:", line.trim());

                // Detect successful startup
                if (line.includes("admin endpoint started")) {
                    isStarted = true;
                    resolve();
                }
            });

            // listen for stdout
            childProcess.stdout?.on("data", (data) => {
                if (isStarted) {
                    return;
                }
                const line = data.toString();
                console.log("[Caddy]", line.trim());

                // Detect successful startup
                if (line.includes("admin endpoint started")) {
                    isStarted = true;
                    resolve();
                }
            });
        });

        // post the initial config
        console.log("Start posting caddy config...");
        await this.postConfig(defaultConfig);
        console.log("Done posting caddy config.");
    }

    async stop() {
        // Make sure to kill any running caddy processes
        try {
            const cmd = "brew services stop caddy";
            await exec(cmd);
        } catch (error) {
            // ignore
        }

        // Make sure to kill any running caddy processes
        try {
            const cmd = "caddy stop";
            await exec(cmd);
        } catch (error) {
            // ignore
        }
    }

    async configure(routes: any[], domains: string[]) {
        const existingRoutes = await this.getRoutes();

        const newRoutes = routes.filter(
            (r) => !existingRoutes.some((er) => er.group === r.group),
        );

        // put at the beginning
        const putPromises = newRoutes.map((r) => this.putRoute(r, 0));
        await Promise.all(putPromises);

        const subjects = await this.getPolicySubjects();
        const newSubjects = domains.filter((d) => !subjects.includes(d));
        await this.postPolicySubjects(newSubjects);
    }

    private async putRoute(route: any, index: number) {
        const url = `${this.cadyUrl}/config/apps/http/servers/${this.serverName}/routes/${index}`;

        try {
            const res = await fetch(url, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(route),
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(
                    `Failed to put route at index ${index}: ${res.status} ${res.statusText} - ${text}`,
                );
            }
        } catch (error) {
            console.error(error);
            console.error("Failed to put route for url: ", url);
            console.error("route: ", JSON.stringify(route));
            await this.logConfig();
        }
    }

    private async postConfig(caddyConfig: any) {
        const url = `${this.cadyUrl}/load`;

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(caddyConfig),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(
                `Failed to post config: ${res.status} ${res.statusText} - ${text}`,
            );
        }
    }

    private async postPolicySubjects(policySubjects: string[]) {
        const url = `${this.cadyUrl}/config/apps/tls/automation/policies/0/subjects/...`;

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(policySubjects),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(
                `Failed to post: ${res.status} ${res.statusText} - ${text}`,
            );
        }
    }

    private async getPolicySubjects() {
        const url = `${this.cadyUrl}/config/apps/tls/automation/policies/0/subjects`;
        const result = await fetch(url);
        const policySubjects: string[] = await result.json();
        return policySubjects;
    }

    private async getRoutes() {
        const url = `${this.cadyUrl}/config/apps/http/servers/${this.serverName}/routes`;
        const result = await fetch(url);
        const routes: { group?: string; match?: any[] }[] = await result.json();
        return routes;
    }

    private async getConfig() {
        const url = `${this.cadyUrl}/config`;
        const result = await fetch(url);
        return await result.json();
    }

    async logConfig() {
        const config = await this.getConfig();
        console.log(JSON.stringify(config, null, 2));
    }

    async deleteRoutesWhere(predicate: (route: { group?: string }) => boolean) {
        const routes = await this.getRoutes();
        const routesToKeep = routes.filter((r) => !predicate(r));

        const url = `${this.cadyUrl}/config/apps/http/servers/${this.serverName}/routes`;

        const res = await fetch(url, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(routesToKeep),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(
                `Failed to patch: ${res.status} ${res.statusText} - ${text}`,
            );
        }
    }

    async deletePolicySubjectsWhere(predicate: (subject: string) => boolean) {
        const subjects = await this.getPolicySubjects();
        const subjectsToKeep = subjects.filter((s) => !predicate(s));

        const url = `${this.cadyUrl}/config/apps/tls/automation/policies/0/subjects`;

        const res = await fetch(url, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(subjectsToKeep),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(
                `Failed to patch: ${res.status} ${res.statusText} - ${text}`,
            );
        }
    }
}
