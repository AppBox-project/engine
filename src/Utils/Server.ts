import DatabaseModel from "./Classes/DatabaseModel";
import { map } from "lodash";
import Automation from "./Classes/Automation";
var mongoose = require("mongoose");

export default class Server {
  models: DatabaseModel;
  whenReady;
  automations: { [key: string]: Automation } = {};
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
  // --> Perform various tasks.
  // ---> Compile formulas
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
  // --> Get all formula fields and compile them
  compileFormulas = () =>
    new Promise(async (resolve) => {
      const models = await this.models.models.model.find();
      await models.reduce(async (prev, model) => {
        const fields = Object.keys(model.fields);
        //@ts-ignore
        await fields.reduce(async (prevField, fieldKey) => {
          const field = model.fields[fieldKey];
          if (field.type === "formula") {
            // console.log(field.typeArgs.formula);
            const automationName = `${model.key}-${fieldKey}`;
            const newAutomation = new Automation(
              automationName,
              model,
              this.models
            );
            await newAutomation.compileFormula(
              field.typeArgs.formula,
              fieldKey
            );

            this.automations[automationName] = newAutomation;
          }
          return field;
        }, fields[0]);
        return model;
      }, models[0]);
      resolve();
    });
}
