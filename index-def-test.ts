import { Request } from './src/routing/classes/Request';
import { GetMember } from './src/members/endpoints/GetMember';

console.log("Start");
// Test endpoint
const getMemberEndpoint = new GetMember()
const r = Request.buildJson("GET", "/members/67");

const start = async () => {
    const response = await getMemberEndpoint.run(r);
    if (response) {
        console.log(response.body)
    } else {
        console.log("no response")
    }
};

start().catch((error) => {
    console.error('unhandledRejection', error);
    process.exit(1);
}).finally(() => {
    process.exit();
});
