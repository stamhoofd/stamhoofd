import http from "http";
import { CreateMember } from './src/endpoints/CreateMember';
import { Request } from './src/classes/routing/Request';

const requestListener = function (req: http.IncomingMessage, res: http.ServerResponse) {
    res.writeHead(200);
    res.end("Hello, World!");
};

const server = http.createServer(requestListener);

console.log("Starting server...");
server.listen(8080);

// Test endpoint
const createMemberEndpoint = new CreateMember()
const r = new Request();
r.body = JSON.stringify({
    name: "Simon",
});
r.headers['Content-Type'] = "application/MemberStructV1";
r.headers['Accept'] = "application/CreatedMemberStructV2";

const response = createMemberEndpoint.run(r);
if (response) {
    console.log(response.body)
}

/*
console.log("Start benchmarking");
const requestCount = 10000000
const begin = process.hrtime();

for (let index = 0; index < requestCount; index++) {
    var response = createMemberEndpoint.run(r);
}
const nanoSeconds = process.hrtime(begin).reduce((sec, nano) => sec * 1e9 + nano)
const seconds = nanoSeconds / 1000 / 1000 / 1000
console.log("Total duration: ", nanoSeconds, seconds);
console.log("Requests per second: ", requestCount / seconds);
*/