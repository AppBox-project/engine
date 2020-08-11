import { systemLog } from "./Utils/General";
import { map } from "lodash";
var cron = require("node-cron");

//@ts-ignore
var mongoose = require("mongoose");
//@ts-ignore
require("./Utils/Models/Objects");
//@ts-ignore
require("./Utils/Models/Archive");
//@ts-ignore
require("./Utils/Models/Entries");
//@ts-ignore
require("./Utils/Models/AppPermissions");
//@ts-ignore
require("./Utils/Models/UserSettings");

systemLog("Kickstarting engine.");

// Variables
const automations = [];

// Connect to mongo (required for engine to run)
mongoose.connect(
  `mongodb://${
    process.env.dbUrl ? process.env.dbUrl : "192.168.0.2:27017"
  }/AppBox`,
  {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
  }
);
var db = mongoose.connection;
db.on("error", console.error.bind(console, "Connection error:"));
db.once("open", async function () {
  const models = {
    objects: {
      model: mongoose.model("Objects"),
      stream: db.collection("objects").watch(),
      listeners: {},
    },
    archive: {
      model: mongoose.model("Archive"),
      listeners: {},
    },
    entries: {
      model: mongoose.model("Entries"),
      stream: db.collection("entries").watch(),
      listeners: {},
    },
    apppermissions: {
      model: mongoose.model("AppPermissions"),
    },
    usersettings: {
      model: mongoose.model("UserSettings"),
      stream: db.collection("usersettings").watch(),
      listeners: {},
    },
  };

  // Change streams
  models.objects.stream.on("change", (change) => {
    map(models.objects.listeners, (listener) => {
      //@ts-ignore
      listener(change);
    });
  });
  models.entries.stream.on("change", (change) => {
    map(models.entries.listeners, (listener, key) => {
      //@ts-ignore
      listener(change);
    });
  });
  models.usersettings.stream.on("change", (change) => {
    map(models.usersettings.listeners, (listener) => {
      //@ts-ignore
      listener(change);
    });
  });

  // Database initiated
  systemLog("Vroom! Engine started.");

  // Execute scripts
  automations.push(require("./Automations/sample"));
  console.log(`registered:`, automations);

  // Time based automations
  // Todo: turn these off when not neccessary.
  cron.schedule("* * * * * *", () => {
    console.log(`Fired!`, automations[0].action());
  });
});
