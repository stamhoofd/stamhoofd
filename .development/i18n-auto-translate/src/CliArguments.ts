export class CliArguments {
    private _fake = false;

    get fake() {
        return this._fake;
    }

    constructor() {
        this.init();
    }

    private init(): void {
        const args = process.argv.slice(2);

        for (const arg of args) {
            if (arg === "--fake") {
                this._fake = true;
                continue;
            }

            throw new Error("Unknown argument: " + arg);
        }
    }
}

export const cliArguments = new CliArguments();
