export class CaddyHelper {
    private cadyUrl = "http://localhost:2019";
    private serverName = "stamhoofd";
    readonly GROUP_PREFIX = "playwright";

    async configure(routes: any[], domains: string[]) {
        const existingRoutes = await this.getRoutes();
        const filteredRoutes: any[] = [];
        const lastRoutes: any[] = [];

        for (const route of existingRoutes) {
            if (routes.some((r) => r.group === route.group)) {
                continue;
            }

            // route without match should be last
            if (route.match === undefined) {
                lastRoutes.push(route);
                continue;
            }

            filteredRoutes.push(route);
        }

        await this.patchRoutes([...filteredRoutes, ...routes, ...lastRoutes]);

        const subjects = await this.getPolicySubjects();
        const newSubjects = domains.filter((d) => !subjects.includes(d));
        await this.postPolicySubjects(newSubjects);

        return {
            cleanup: async () => {
                await this.deleteRoutesWhere(
                    (route) =>
                        !!route.group &&
                        routes.some((r) => r.group === route.group),
                );

                await this.deletePolicySubjectsWhere((subject) =>
                    domains.includes(subject));
            },
        };
    }

    async deletePlaywrightConfig() {
        await this.deleteAllPlaywrightRoutes();
        await this.deleteAllPlaywrightTlsPolicySubjects();
    }

    private async deleteAllPlaywrightTlsPolicySubjects() {
        await this.deletePolicySubjectsWhere((subject) => subject.includes(this.GROUP_PREFIX));
    }

    private async deleteAllPlaywrightRoutes() {
        await this.deleteRoutesWhere((route: { group?: string }) => {
            if (route.group === undefined) {
                return false;
            }

            return route.group.startsWith(this.GROUP_PREFIX + "-");
        });
    }

    private async patchRoutes(routes: any[]) {
        const url = `${this.cadyUrl}/config/apps/http/servers/${this.serverName}/routes`;

        const res = await fetch(url, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(routes),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(
                `Failed to patch routes: ${res.status} ${res.statusText} - ${text}`,
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

    private async deleteRoutesWhere(
        predicate: (route: { group?: string }) => boolean,
    ) {
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

    private async deletePolicySubjectsWhere(
        predicate: (subject: string) => boolean,
    ) {
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
