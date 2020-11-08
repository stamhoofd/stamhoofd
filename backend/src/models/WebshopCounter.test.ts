import { WebshopCounter } from "./WebshopCounter";

describe("WebshopCounter", () => {
    test("Create multiple order numbers", async () => {
        const first = WebshopCounter.getNextNumber("ADGS")
        const second = WebshopCounter.getNextNumber("ADGS")
        const other = WebshopCounter.getNextNumber("ZEGQ")
        const last = WebshopCounter.getNextNumber("ADGS")

        await expect(first).resolves.toEqual(1)
        await expect(second).resolves.toEqual(2)
        await expect(last).resolves.toEqual(3)
        await expect(other).resolves.toEqual(1)
    });
});
