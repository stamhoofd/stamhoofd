import { beforeEach, describe, expect, it, vi } from "vitest";
import Sgv from "./sgv.js";
import { runSgvMock } from "../workflows/start-sgv-mock.js";

vi.mock("../workflows/start-sgv-mock.js", () => ({
    runSgvMock: vi.fn(),
}));

describe("SGV command", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("starts the SGV mock workflow with the selected context", async () => {
        const command = new Sgv([], {} as any);
        (command as any).parse = vi.fn(async () => ({
            flags: { env: "keeo", name: "feature-sgv", verbose: true },
        }));
        (command as any).createContext = vi.fn(async () => ({
            context: "sgv",
        }));

        await command.run();

        expect((command as any).createContext).toHaveBeenCalledWith({
            env: "keeo",
            name: "feature-sgv",
            verbose: true,
        });
        expect(runSgvMock).toHaveBeenCalledWith({ context: "sgv" });
    });
});
