import Server from "./Utils/Server";

// Variables
const server = new Server();

server.whenReady.then(() => {
  server.rebuild().then(() => {
    console.log("Re-index done.");
  });
});
