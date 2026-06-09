import { BaseCommand } from "../base-command.js";
import { runSgvMock } from "../workflows/start-sgv-mock.js";

export default class Sgv extends BaseCommand {
    static summary = "Run the local SGV mock backend";
    static description =
        "Starts the local Scouts en Gidsen Vlaanderen mock backend and configures Caddy routes for the login and admin hostnames.";
    static examples = ["stam sgv", "stam sgv --env keeo --name feature-sgv"];

    static flags = {
        ...BaseCommand.instanceFlags,
    };

    async run(): Promise<void> {
        const { flags } = await this.parse(Sgv);
        await runSgvMock(await this.createContext(flags));
    }
}
