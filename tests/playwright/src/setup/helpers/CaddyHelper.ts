export class CaddyHelper {
    private cadyUrl = "http://localhost:2019";
    private serverName = "stamhoofd";
    readonly GROUP_PREFIX = "playwright";

    async configure(routes: any[]) {
        const existingRoutes = await this.getRoutes();
        const newRoutes = routes.filter(
            (r) => !existingRoutes.some((er) => er.group === r.group),
        );

        await this.postRoutes(newRoutes);

        return {
            cleanup: async () => {
                await this.deleteRoutesWhere(
                    (route) =>
                        !!route.group &&
                        routes.some((r) => r.group === route.group),
                );
            },
        };
    }

    async deleteAllPlaywrightRoutes() {
        await this.deleteRoutesWhere(
            (route: { group?: string }) => {
                if(route.group === undefined) {
                    return false;
                }

                return route.group.startsWith(this.GROUP_PREFIX+'-');
            },
        );
    }

    async deleteAllPlaywrightRoutesForWorker(workerId: string) {
        await this.deleteRoutesWhere(
            (route: { group?: string }) => {
                if(route.group === undefined) {
                    return false;
                }

                return route.group.startsWith(this.GROUP_PREFIX+'-') && route.group.endsWith(`-${workerId}`);
            },
        );
    }

    // async postRoute(route: any) {
    //     // first get routes and check if route already exists
    //     const url = `${this.cadyUrl}/config/apps/http/servers/${this.serverName}/routes`;

    //     const res = await fetch(url, {
    //         method: "POST",
    //         headers: { "Content-Type": "application/json" },
    //         body: JSON.stringify(route),
    //     });

    //     if (!res.ok) {
    //         const text = await res.text();
    //         throw new Error(
    //             `Failed to post: ${res.status} ${res.statusText} - ${text}`,
    //         );
    //     }
    // }

    private async postRoutes(routes: any[]) {
        // first get routes and check if route already exists
        const url = `${this.cadyUrl}/config/apps/http/servers/${this.serverName}/routes/...`;

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(routes),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(
                `Failed to post routes: ${res.status} ${res.statusText} - ${text}`,
            );
        }
    }

    // async postPolicySubjects(policySubjects: string[]) {
    //     const url = `${this.cadyUrl}/config/apps/tls/automation/policies/0/subjects/...`;

    //     const res = await fetch(url, {
    //         method: "POST",
    //         headers: { "Content-Type": "application/json" },
    //         body: JSON.stringify(policySubjects),
    //     });

    //     if (!res.ok) {
    //         const text = await res.text();
    //         throw new Error(
    //             `Failed to post: ${res.status} ${res.statusText} - ${text}`,
    //         );
    //     }
    // }

    // async deletePolicySubject(policySubject: string) {
    //     // todo: make safe if used in parallel / async
    //     const subjects = await this.getPolicySubjects();
    //     const index = subjects.findIndex(
    //         (subject: string) => subject === policySubject,
    //     );
    //     if (index === -1) {
    //         return;
    //     }

    //     const url = `${this.cadyUrl}/config/apps/tls/automation/policies/0/subjects/${index}`;

    //     const res = await fetch(url, {
    //         method: "DELETE",
    //     });

    //     if (!res.ok) {
    //         const text = await res.text();
    //         throw new Error(
    //             `Failed to delete policy subject: ${res.status} ${res.statusText} - ${text}`,
    //         );
    //     }

    //     console.log(`Policy subject at index ${index} deleted successfully.`);
    // }

    // async getPolicySubjects() {
    //     // todo: make safe if used in parallel / async
    //     const url = `${this.cadyUrl}/config/apps/tls/automation/policies/0/subjects`;
    //     const result = await fetch(url);
    //     const policySubjects: string[] = await result.json();
    //     return policySubjects;
    // }

    private async getRoutes() {
        const url = `${this.cadyUrl}/config/apps/http/servers/${this.serverName}/routes`;
        const result = await fetch(url);
        const routes: { group?: string }[] = await result.json();
        return routes;
    }

    // private async getRouteIndexByGroup(group: string) {
    //     const routes: { group?: string }[] = await this.getRoutes();
    //     const index = routes.findIndex((route: any) => route.group === group);
    //     return index;
    // }

    // async deleteRouteByGroup(group: string) {
    //     // todo: make safe if used in parallel / async
    //     const index = await this.getRouteIndexByGroup(group);

    //     if (index === -1) {
    //         // no route with this group
    //         return;
    //     }

    //     const url = `${this.cadyUrl}/config/apps/http/servers/${this.serverName}/routes/${index}`;

    //     const res = await fetch(url, { method: "DELETE" });

    //     if (!res.ok) {
    //         const text = await res.text();
    //         throw new Error(
    //             `Failed to delete route: ${res.status} ${res.statusText} - ${text}`,
    //         );
    //     }

    //     console.log(`Route at index ${index} deleted successfully.`);
    // }

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
}
