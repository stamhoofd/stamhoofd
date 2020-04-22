/* eslint-disable @typescript-eslint/unbound-method */
import { Model } from "./Model";
import { column } from "../decorators/Column";
import { Database } from "./Database";
import { ManyToManyRelation } from "./ManyToManyRelation";
import { ManyToOneRelation } from "./ManyToOneRelation";

describe("Model", () => {
    // Create a new class
    class TestModel extends Model {
        static table = "testModels";

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

        @column({ foreignKey: TestModel.partner, type: "integer", nullable: true })
        partnerId: number | null = null; // null = no address

        static partner = new ManyToOneRelation(TestModel, "partner");
        static friends = new ManyToManyRelation(TestModel, TestModel, "friends");
    }

    test("Not possible to choose own primary key for integer type primary", async () => {
        const m = new TestModel();
        m.id = 123;
        m.name = "My name";
        m.count = 1;
        m.isActive = true;
        m.createdOn = new Date();
        m.birthDay = new Date(1990, 0, 1);
        await expect(m.save()).rejects.toThrow(/primary/i);
    });

    test("Creating a model requires to set all properties", async () => {
        const m = new TestModel();
        m.name = "My name";
        m.isActive = true;
        m.createdOn = new Date();
        await expect(m.save()).rejects.toThrow(/count/i);
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
        expect(m.existsInDatabase).toEqual(true);
        expect(m.id).toBeGreaterThanOrEqual(1);

        const [rows] = await Database.select("SELECT * from testModels where id = ?", [m.id]);
        expect(rows).toHaveLength(1);
        const row = rows[0];
        expect(row).toHaveProperty("testModels");
        const selected = TestModel.fromRow(row["testModels"]) as any;

        expect(selected).toEqual(m);
        expect(selected.id).toEqual(m.id);
    });

    test("You cannot set a relation directly", async () => {
        const other = new TestModel();
        other.name = "My partner";
        other.isActive = true;
        other.count = 1;
        other.createdOn = new Date();
        await other.save();
        expect(other.existsInDatabase).toEqual(true);

        const m = new TestModel();
        m.name = "My name";
        m.isActive = true;
        m.count = 1;
        m.createdOn = new Date();
        // MySQL cannot save milliseconds. Data is rounded if not set to zero.
        m.createdOn.setMilliseconds(0);

        m.birthDay = new Date(1990, 0, 1);

        // setRelation is the correct way to do it (it would throw now):
        //m.setRelation(TestModel.partner, other);
        // but we test what happens if we set the relation the wrong way
        (m as any).partner = other;

        await expect(m.save()).rejects.toThrow(/foreign key/i);
    });

    test("Save before setting a many to one relation", () => {
        const other = new TestModel();
        other.name = "My partner";
        other.isActive = true;
        other.count = 1;
        other.createdOn = new Date();

        const m = new TestModel();
        m.name = "My name";
        m.isActive = true;
        m.count = 1;
        m.createdOn = new Date();
        // MySQL cannot save milliseconds. Data is rounded if not set to zero.
        m.createdOn.setMilliseconds(0);

        m.birthDay = new Date(1990, 0, 1);

        expect(() => {
            m.setRelation(TestModel.partner, other);
        }).toThrow(/not yet saved/i);
    });

    test("Setting a many to one relation", async () => {
        const other = new TestModel();
        other.name = "My partner";
        other.isActive = true;
        other.count = 1;
        other.createdOn = new Date();
        await other.save();
        expect(other.existsInDatabase).toEqual(true);

        const m = new TestModel() as any;
        m.name = "My name";
        m.isActive = true;
        m.count = 1;
        m.createdOn = new Date();
        // MySQL cannot save milliseconds. Data is rounded if not set to zero.
        m.createdOn.setMilliseconds(0);

        m.birthDay = new Date(1990, 0, 1);
        m.setRelation(TestModel.partner, other);
        expect(m.partner.id).toEqual(other.id);
        expect(m.partnerId).toEqual(other.id);

        await m.save();
        expect(m.existsInDatabase).toEqual(true);
        expect(m.partnerId).toEqual(other.id);
        expect(m.partner.id).toEqual(other.id);
    });

    test("Setting a many to one relation by ID", async () => {
        const other = new TestModel();
        other.name = "My partner";
        other.isActive = true;
        other.count = 1;
        other.createdOn = new Date();
        await other.save();
        expect(other.existsInDatabase).toEqual(true);
        expect(other.partnerId).toEqual(null);
        expect(other.birthDay).toEqual(null);

        const m = new TestModel() as any;
        m.name = "My name";
        m.isActive = true;
        m.count = 1;
        m.createdOn = new Date();
        // MySQL cannot save milliseconds. Data is rounded if not set to zero.
        m.createdOn.setMilliseconds(0);

        m.birthDay = new Date(1990, 0, 1);
        m.partnerId = other.id;

        await m.save();
        expect(m.existsInDatabase).toEqual(true);
        expect(m.partnerId).toEqual(other.id);
        expect(TestModel.partner.isLoaded(m)).toEqual(false);
        expect(TestModel.partner.isSet(m)).toEqual(false);

        const [rows] = await Database.select("SELECT * from testModels where id = ?", [m.id]);
        expect(rows).toHaveLength(1);
        const row = rows[0];
        expect(row).toHaveProperty("testModels");
        const selected = TestModel.fromRow(row["testModels"]) as any;

        expect(TestModel.partner.isLoaded(selected)).toEqual(false);
        expect(TestModel.partner.isSet(selected)).toEqual(false);
        expect(selected.partnerId).toEqual(other.id);
    });

    test("Clearing a many to one relation", async () => {
        const other = new TestModel();
        other.name = "My partner";
        other.isActive = true;
        other.count = 1;
        other.createdOn = new Date();
        await other.save();
        expect(other.existsInDatabase).toEqual(true);

        const m = new TestModel() as any;
        m.name = "My name";
        m.isActive = true;
        m.count = 1;
        m.createdOn = new Date();
        m.partnerId = other.id;
        await m.save();
        expect(m.existsInDatabase).toEqual(true);
        expect(m.partnerId).toEqual(other.id);

        m.setOptionalRelation(TestModel.partner, null);
        expect(m.partnerId).toEqual(null);
        expect(m.partner).toEqual(null);
        await m.save();
        expect(m.partnerId).toEqual(null);
        expect(m.partner).toEqual(null);

        const [rows] = await Database.select("SELECT * from testModels where id = ?", [m.id]);
        expect(rows).toHaveLength(1);
        const row = rows[0];
        expect(row).toHaveProperty("testModels");
        const selected = TestModel.fromRow(row["testModels"]) as any;
        expect(selected.partnerId).toEqual(null);
    });

    test("Clearing a many to one relation by ID", async () => {
        const other = new TestModel();
        other.name = "My partner";
        other.isActive = true;
        other.count = 1;
        other.createdOn = new Date();
        expect(await other.save()).toEqual(true);
        expect(other.existsInDatabase).toEqual(true);

        const m = new TestModel() as any;
        m.name = "My name";
        m.isActive = true;
        m.count = 1;
        m.createdOn = new Date();
        m.partnerId = other.id;
        expect(await m.save()).toEqual(true);

        expect(m.existsInDatabase).toEqual(true);
        expect(m.partnerId).toEqual(other.id);

        m.partnerId = null;
        expect(await m.save()).toEqual(true);
        expect(m.partnerId).toEqual(null);

        const [rows] = await Database.select("SELECT * from testModels where id = ?", [m.id]);
        expect(rows).toHaveLength(1);
        const row = rows[0];
        expect(row).toHaveProperty("testModels");
        const selected = TestModel.fromRow(row["testModels"]) as any;
        expect(selected.partnerId).toEqual(null);
    });

    test("No query if no changes", async () => {
        const other = new TestModel();
        other.name = "No query if no changes";
        other.isActive = true;
        other.count = 1;
        other.createdOn = new Date();

        const firstSave = await other.save();
        expect(firstSave).toEqual(true);

        expect(other.existsInDatabase).toEqual(true);
        expect(other.partnerId).toEqual(null);
        expect(other.birthDay).toEqual(null);

        other.count = 1;
        const saved = await other.save();
        expect(saved).toEqual(false);
    });

    test("Update a model", async () => {
        const other = new TestModel();
        other.name = "Update a model";
        other.isActive = true;
        other.count = 1;
        other.createdOn = new Date();

        expect(other.existsInDatabase).toEqual(false);
        expect(await other.save()).toEqual(true);
        expect(other.existsInDatabase).toEqual(true);

        other.count = 2;
        expect(await other.save()).toEqual(true);
        expect(other.existsInDatabase).toEqual(true);
    });

    let friend1, friend2, friend3, meWithoutFriends: TestModel;
    let meWithFriends: TestModel & { friends: TestModel[] };
    test("Set a many to many relationship", async () => {
        friend1 = new TestModel();
        friend1.name = "Friend 1";
        friend1.isActive = true;
        friend1.count = 1;
        friend1.createdOn = new Date();

        expect(await friend1.save()).toEqual(true);

        friend2 = new TestModel();
        friend2.name = "Friend 2";
        friend2.isActive = true;
        friend2.count = 2;
        friend2.createdOn = new Date();

        expect(await friend2.save()).toEqual(true);

        friend3 = new TestModel();
        friend3.name = "Friend 3";
        friend3.isActive = true;
        friend3.count = 3;
        friend3.createdOn = new Date();

        expect(await friend3.save()).toEqual(true);

        meWithFriends = new TestModel().setManyRelation(TestModel.friends, []);
        meWithFriends.name = "Me";
        meWithFriends.isActive = true;
        meWithFriends.count = 1;
        meWithFriends.createdOn = new Date();

        expect(await meWithFriends.save()).toEqual(true);

        await TestModel.friends.link(meWithFriends, friend1, friend2);
        if (TestModel.friends.isLoaded(meWithFriends)) {
            expect(meWithFriends.friends).toHaveLength(2);
            expect(meWithFriends.friends[0].id).toEqual(friend1.id);
            expect(meWithFriends.friends[1].id).toEqual(friend2.id);
        } else {
            expect("other friends not loaded").toEqual("other friends loaded");
        }

        // Check also saved in database
        const [rows] = await Database.select(
            "SELECT * from testModels " +
                TestModel.friends.joinQuery("testModels", "friends") +
                " where testModels.id = ?",
            [meWithFriends.id]
        );

        const _meWithoutFriends = TestModel.fromRow(rows[0]["testModels"]);
        expect(_meWithoutFriends).toBeDefined();
        if (!_meWithoutFriends) return;
        meWithoutFriends = _meWithoutFriends;
        expect(meWithoutFriends.id).toEqual(meWithFriends.id);

        const friends = TestModel.fromRows(rows, "friends");
        expect(friends).toHaveLength(2);
        expect(friends[0].id).toEqual(friend1.id);
        expect(friends[1].id).toEqual(friend2.id);
    });

    test("Unlink a many to many relationship", async () => {
        // Now unlink one
        await TestModel.friends.unlink(meWithFriends, friend1);
        if (TestModel.friends.isLoaded(meWithFriends)) {
            expect(meWithFriends.friends).toHaveLength(1);
            expect(meWithFriends.friends[0].id).toEqual(friend2.id);
        } else {
            expect("other friends not loaded").toEqual("other friends loaded");
        }

        const [rows] = await Database.select(
            "SELECT * from testModels " +
                TestModel.friends.joinQuery("testModels", "friends") +
                " where testModels.id = ?",
            [meWithFriends.id]
        );

        const meAgain = TestModel.fromRow(rows[0]["testModels"]);
        expect(meAgain).toBeDefined();
        if (!meAgain) return;
        expect(meAgain.id).toEqual(meWithFriends.id);

        const friendsAgain = TestModel.fromRows(rows, "friends");
        expect(friendsAgain).toHaveLength(1);
        expect(friendsAgain[0].id).toEqual(friend2.id);
    });

    test("Clear a many to many relationship", async () => {
        // Now unlink one
        await TestModel.friends.clear(meWithFriends);
        if (TestModel.friends.isLoaded(meWithFriends)) {
            expect(meWithFriends.friends).toHaveLength(0);
        } else {
            expect("other friends not loaded").toEqual("other friends loaded");
        }

        const [rows] = await Database.select(
            "SELECT * from testModels " +
                TestModel.friends.joinQuery("testModels", "friends") +
                " where testModels.id = ?",
            [meWithFriends.id]
        );

        const meAgain = TestModel.fromRow(rows[0]["testModels"]);
        expect(meAgain).toBeDefined();
        if (!meAgain) return;
        expect(meAgain.id).toEqual(meWithFriends.id);

        const friendsAgain = TestModel.fromRows(rows, "friends");
        expect(friendsAgain).toHaveLength(0);
    });

    test("Link a not loaded many to many relation", async () => {
        // Now unlink one
        await TestModel.friends.link(meWithoutFriends, friend3, friend2, friend1);
        expect(TestModel.friends.isLoaded(meWithoutFriends)).toEqual(false);

        const [rows] = await Database.select(
            "SELECT * from testModels " +
                TestModel.friends.joinQuery("testModels", "friends") +
                " where testModels.id = ?",
            [meWithoutFriends.id]
        );

        const meAgain = TestModel.fromRow(rows[0]["testModels"]);
        expect(meAgain).toBeDefined();
        if (!meAgain) return;
        expect(meAgain.id).toEqual(meWithoutFriends.id);

        const friendsAgain = TestModel.fromRows(rows, "friends");
        expect(friendsAgain).toHaveLength(3);
        expect(friendsAgain.map(f => f.id)).toIncludeSameMembers([friend3.id, friend2.id, friend1.id]);
    });

    test("Unlink a not loaded many to many relation", async () => {
        // Now unlink one
        await TestModel.friends.unlink(meWithoutFriends, friend3);
        expect(TestModel.friends.isLoaded(meWithoutFriends)).toEqual(false);

        const [rows] = await Database.select(
            "SELECT * from testModels " +
                TestModel.friends.joinQuery("testModels", "friends") +
                " where testModels.id = ?",
            [meWithoutFriends.id]
        );

        const meAgain = TestModel.fromRow(rows[0]["testModels"]);
        expect(meAgain).toBeDefined();
        if (!meAgain) return;
        expect(meAgain.id).toEqual(meWithoutFriends.id);

        const friendsAgain = TestModel.fromRows(rows, "friends");
        expect(friendsAgain.map(f => f.id)).toIncludeSameMembers([friend2.id, friend1.id]);
    });

    test("Load a M2M relation", async () => {
        // Get a clean one, because we don't want to affect the other tests
        const [rows] = await Database.select("SELECT * from testModels where id = ? LIMIT 1", [meWithFriends.id]);
        expect(rows).toHaveLength(1);
        const row = rows[0];
        expect(row).toHaveProperty("testModels");
        const selected = TestModel.fromRow(row["testModels"]) as any;
        expect(selected).toBeDefined();

        expect(TestModel.friends.isLoaded(selected)).toEqual(false);
        const friends = await TestModel.friends.load(selected);
        expect(TestModel.friends.isLoaded(selected)).toEqual(true);
        expect(selected.friends).toEqual(friends);
        expect(friends.map(f => f.id)).toIncludeSameMembers([friend2.id, friend1.id]);
    });

    test("Clear a not loaded many to many relation", async () => {
        // Now unlink one
        await TestModel.friends.clear(meWithoutFriends);
        expect(TestModel.friends.isLoaded(meWithoutFriends)).toEqual(true); // should be true, because we can automatically load the relation if it is not yet loaded
        expect((meWithoutFriends as any).friends).toHaveLength(0);

        const [rows] = await Database.select(
            "SELECT * from testModels " +
                TestModel.friends.joinQuery("testModels", "friends") +
                " where testModels.id = ?",
            [meWithoutFriends.id]
        );

        const meAgain = TestModel.fromRow(rows[0]["testModels"]);
        expect(meAgain).toBeDefined();
        if (!meAgain) return;
        expect(meAgain.id).toEqual(meWithoutFriends.id);

        const friendsAgain = TestModel.fromRows(rows, "friends");
        expect(friendsAgain).toHaveLength(0);
    });

    test("Load an empty M2M relation", async () => {
        // Get a clean one, because we don't want to affect the other tests
        const [rows] = await Database.select("SELECT * from testModels where id = ? LIMIT 1", [meWithFriends.id]);
        expect(rows).toHaveLength(1);
        const row = rows[0];
        expect(row).toHaveProperty("testModels");
        const selected = TestModel.fromRow(row["testModels"]) as any;
        expect(selected).toBeDefined();

        expect(TestModel.friends.isLoaded(selected)).toEqual(false);
        const friends = await TestModel.friends.load(selected);
        expect(TestModel.friends.isLoaded(selected)).toEqual(true);
        expect(selected.friends).toEqual(friends);
        expect(friends).toBeEmpty();
    });

    test("You can't set many to many if not yet saved", async () => {
        const friend1 = new TestModel();
        friend1.name = "Friend 1";
        friend1.isActive = true;
        friend1.count = 1;
        friend1.createdOn = new Date();

        expect(await friend1.save()).toEqual(true);

        const friend2 = new TestModel();
        friend2.name = "Friend 2";
        friend2.isActive = true;
        friend2.count = 1;
        friend2.createdOn = new Date();

        const other = new TestModel().setManyRelation(TestModel.friends, []);
        other.name = "Me";
        other.isActive = true;
        other.count = 1;
        other.createdOn = new Date();

        expect(await other.save()).toEqual(true);
        await expect(TestModel.friends.link(other, friend1, friend2)).rejects.toThrow(/not saved yet/);
    });
});
