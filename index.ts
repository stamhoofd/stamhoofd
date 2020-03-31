import { Member, FullyLoadedMember } from "./src/members/models/Member";
import { Address } from "./src/members/models/Address";
import { Parent } from "./src/members/models/Parent";
import { Router } from "./src/routing/classes/Router";
import { Request } from "./src/routing/classes/Request";
import { RouterServer } from "./src/routing/classes/RouterServer";
import { Database } from "./src/database/classes/Database";

process.on("unhandledRejection", (error: Error) => {
    console.error("unhandledRejection");
    console.error(error.message, error.stack);
    process.exit(1);
});

// Set timezone!
process.env.TZ = "UTC";

// Quick check
if (new Date().getTimezoneOffset() != 0) {
    throw new Error("Process should always run in UTC timezone");
}

const start = async () => {
    const router = new Router();
    await router.loadAllEndpoints(__dirname + "/src");

    const routerServer = new RouterServer(router);
    routerServer.listen(8080);

    process.on("SIGINT", () => {
        console.info("SIGINT signal received.");

        routerServer
            .close()
            .then(() => {
                console.log("Server stopped");

                Database.end()
                    .then(() => {
                        console.log("MySQL connections closed");

                        // Should not be needed, but added for security
                        process.exit();
                    })
                    .catch(err => {
                        console.error(err);
                    });
            })
            .catch(err => {
                console.error(err);
            });
    });

    /*try {
        
        const found = await Member.getByID(82);
        let member: FullyLoadedMember;

        if (found) {
            console.log("Found member " + found.firstName);
            member = found;
        } else {
            console.log("Didn't find member");
            const address = new Address();
            address.city = "Demo";
            address.country = "BE";
            address.street = "Straatnaam";
            address.number = "123";
            address.postalCode = "9000";
            await address.save();

            member = new Member()
                .setRelation(Member.address, address)
                .setManyRelation(Member.parents, []);

            member.firstName = "Simon";
            member.lastName = "Backx";
            await member.save();
        }

        member.logCountry();

        if (member.address) {
            console.log(`${member.firstName} woont in ${member.address.city}`);
        } else {
            console.log(`${member.firstName} heeft geen adres`);
        }

        if (member.parents.length == 0) {
            console.log("Linking some parents...");

            const parent1 = new Parent();
            parent1.firstName = "Linda";
            parent1.lastName = "De Mol";
            parent1.mail = "linda.demol@gmail.com";

            const parent2 = new Parent();
            parent2.firstName = "Peter";
            parent2.lastName = "De Vis";
            parent2.mail = "peter.devis@gmail.com";

            await Promise.all([parent1.save(), parent2.save()]);
            await Member.parents.link(member, parent1, parent2);

            if (member.parents.length == 0) {
                throw new Error("Link didn't update parents");
            }
        } else {
            console.log(`${member.firstName} already has parents`);

            const cb = member.parents.length;
            await Member.parents.clear(member);

            if (member.parents.length == cb) {
                throw new Error("unlink didn't update parents");
            }
        }

        console.log("Done.");
    } catch (e) {
        console.error("Failed to save member: ", e);
    }*/
};

start()
    .catch(error => {
        console.error("unhandledRejection", error);
        process.exit(1);
    })
    .finally(() => {
        //process.exit();
    });
