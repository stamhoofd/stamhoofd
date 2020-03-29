import { Model } from "./Model";
import { column } from "../decorators/Column";
import { Database } from "./Database";

describe("Model", () => {
    // Create a new class
    class TestModel extends Model {
        static table = "test_models";

        @column({ primary: true, type: "integer" })
        id: number | null = null;

        @column({ type: "string" })
        name: string;

        @column({ type: "integer" })
        count: number;

        @column({ type: "boolean" })
        isActive: boolean;

        @column({ type: "datetime" })
        createdOn: Date;

        @column({ type: "date", nullable: true })
        birthDay: Date | null = null;
    }

    test("Not possible to choose own primary key", async () => {
        const m = new TestModel();
        m.id = 123;
        m.name = "My name";
        m.count = 1;
        m.isActive = true;
        m.createdOn = new Date();
        m.birthDay = new Date(1990, 0, 1);
        try {
            await m.save();
            throw new Error("Should not be allowed to choose own primary key");
        } catch (e) {
            expect(e.message).toMatch(/primary/i);
        }
    });

    test("Creating a model requires to set all properties", async () => {
        const m = new TestModel();
        m.name = "My name";
        m.isActive = true;
        m.createdOn = new Date();
        try {
            await m.save();
            throw new Error("Should be allowed to save a model without specifiying required property `count`");
        } catch (e) {
            expect(e.message).toMatch(/count/);
        }
    });

    test("Saving a new instance", async () => {
        const m = new TestModel();
        m.name = "My name";
        m.isActive = true;
        m.count = 1;
        m.createdOn = new Date();
        // MySQL cannot save milliseconds. Data is rounded if not set to zero.
        m.createdOn.setMilliseconds(0);

        m.birthDay = new Date(1990, 0, 1);
        await m.save();
        expect(m.id).toBeGreaterThanOrEqual(1);

        const [rows] = await Database.select("SELECT * from test_models where id = ?", [m.id]);
        expect(rows).toHaveLength(1);
        const row = rows[0];
        expect(row).toHaveProperty("test_models");
        const selected = TestModel.fromRow(row["test_models"]) as any;

        expect(selected).toEqual(m);
        expect(selected.id).toEqual(m.id);
    });
});
