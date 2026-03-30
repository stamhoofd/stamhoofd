export class StartupHealthService {
    private static readonly errors = new Set<string>();

    static markUnhealthy(error: string) {
        this.errors.add(error);
    }

    static getErrors() {
        return [...this.errors];
    }

    static clearForTesting() {
        this.errors.clear();
    }
}
