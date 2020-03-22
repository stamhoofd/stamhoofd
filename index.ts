import { Member } from "./src/database/models/Member"


const start = async () => {
    try {
        const member = new Member();

        member.id = 123;
        member.firstName = "Simon";

        await member.save();
        member.firstName = "Simon";
        member.lastName = "Backx";

        await member.save();

    } catch (e) {
        console.error("Failed to save member: ", e);
    }

};

start().catch((error) => { console.error('unhandledRejection', error); });
