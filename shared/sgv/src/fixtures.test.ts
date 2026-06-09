import {
    createSGVMemberFixture,
    defaultSGVFunctions,
    defaultSGVGroupNumber,
} from "./fixtures.js";

describe("@stamhoofd/sgv fixtures", () => {
    it("creates members that can be listed with SGV default functions", () => {
        const member = createSGVMemberFixture();

        expect(defaultSGVFunctions.map((f) => f.code)).toContain("JIN");
        expect(member.functies[0].groep).toBe(defaultSGVGroupNumber);
        expect(member.vgagegevens.voornaam).toBe("Existing");
    });
});
