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
    server.models.objects.stream.on("change", async (dbAction) => {
      let context;
      switch (dbAction.operationType) {
        case "update":
          const object = await server.models.objects.model.findOne({
            _id: dbAction.documentKey._id.toString(),
          });
          context = {
            models: server.models,
            object,
            dbAction,
            change: dbAction.updateDescription.updatedFields,
          };
          server.onReceiveUpdate(context);
          break;
        case "insert":
          context = {
            server,
            object: dbAction.fullDocument,
            dbAction,
            change: dbAction.fullDocument.data,
            models: server.models,
          };
          server.onReceiveUpdate(context);
          break;
        case "delete":
          // Todo, case is here to prevent errors
          break;
        default:
          console.error(`Unknown change operation: ${dbAction.operationType}`);
          break;
      }
    });
  });
});
