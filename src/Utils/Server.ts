import DatabaseModel from "./Classes/DatabaseModel";
import { map } from "lodash";
var mongoose = require("mongoose");

export default class Server {
  models: DatabaseModel;
  whenReady;
  automations = {};
  processes = {};
  fieldTriggers = {};
  timeTriggers = {};

  // Initialize
  constructor() {
    const that = this;
    this.whenReady = new Promise((resolve) => {
      console.log("Kickstarting engine...");

      // Connect to mongo (required for engine to run)
      mongoose.connect(
        `mongodb://${
          process.env.DBURL ? process.env.DBURL : "192.168.0.2:27017"
        }/AppBox`,
        {
          useNewUrlParser: true,
          useCreateIndex: true,
          useUnifiedTopology: true,
        }
      );
      var db = mongoose.connection;
      db.once("open", function () {
        console.log("...Database connected.");
        that.models = new DatabaseModel(db);
        resolve();
      });
    });
  }

  // Rebuild engine
  rebuild = async () =>
    new Promise((resolve) => {
      // Reset variables
      this.automations = {};
      this.processes = {};
      this.fieldTriggers = {};
      this.timeTriggers = {};

      // Perform all tasks
      Promise.all([this.compileFormulas()]).then(() => {
        resolve();
      });
    });

  // Compile formulas
  compileFormulas = () =>
    new Promise(async (resolve) => {
      (await this.models.models.model.find()).map((m) => {
        map(m.fields, (field, key) => {
          if (field.type === "formula") {
            console.log(field);
          }
        });
      });

      resolve();
    });
}
