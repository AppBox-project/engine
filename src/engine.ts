import Server from "./Utils/Server";

/* * * ENGINE
 * Engine is a core part.
 * It is responsible for data mutation.
 * It runs automations, processes
 * It compiles formulas and reacts by updating dependant data if something changes.
 * * */

// Variables
const server = new Server();

// Initialise server and database connection
server.whenReady.then(() => {
  // Since we just launched, rebuild() the server (index all automations)
  server.rebuild().then(() => {
    console.log("--> ✔ Engine rebuild completed.");

    // React to changes.
    server.models.objects.stream.on("change", async (dbChange) => {
      switch (dbChange.operationType) {
        case "update":
          const object = await server.models.objects.model.findOne({
            _id: dbChange.documentKey._id.toString(),
          });
          server.onReceiveUpdate(
            dbChange.updateDescription.updatedFields,
            object
          );
          break;
        default:
          console.log(`Unknown change operation: ${dbChange.operationType}`);
          break;
      }
    });
  });
});
