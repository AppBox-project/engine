import DatabaseModel from "./Classes/DatabaseModel";
import Automation from "./Automation";
import { map } from "lodash";
import { AutomationContext, ObjectType } from "./Types";
var mongoose = require("mongoose");

/* * * SERVER * * *
 * The server is a helper class
 * It connects to the database and builds() all the indexes, processes and automations.
 */
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
      console.log("--> Rebuilding engine logic.");

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
      console.log("--> Compiling formulas...");

      const models = await this.models.models.model.find();
      await models.reduce(async (prev, model) => {
        const fields = Object.keys(model.fields);
        //@ts-ignore
        await fields.reduce(async (prevField, fieldKey) => {
          const field = model.fields[fieldKey];
          if (field.type === "formula") {
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
            if (field.typeArgs?.type === "number")
              newAutomation.formula.outputType = "number";
            if (field.typeArgs?.type === "boolean")
              newAutomation.formula.outputType = "boolean";

            this.automations[automationName] = newAutomation;
          }
          return field;
        }, fields[0]);
        return model;
      }, models[0]);

      // Todo: Figure out why this calls after sync calls, before asyncs are done.
      setTimeout(() => {
        resolve();
      }, 1000);
    });

  // Process update
  // This function is called every time an object is updated or created.
  // It checks the change to see if it triggers an automation. If so, it executes it.
  onReceiveUpdate = (context: AutomationContext) => {
    let changeTriggersAutomation = false;
    const automationsToTrigger: Automation[] = [];
    map(this.automations, (automation: Automation, ak) => {
      map(automation.dependencies, (dependency, dk) => {
        if (dependency.model === context.object.objectId) {
          map(context.change, (updateValue, updateKey) => {
            if (
              dependency.field === "__ANY" || // Any field within this model triggers calculation
              `data.${dependency.field}` === updateKey // Or we're a field match.
            ) {
              if (dependency.foreign) {
                console.log(
                  `Foreign dependency triggered for ${automation.name}, but processes haven't been built yet.`
                );
              } else {
                changeTriggersAutomation = true;
                automationsToTrigger.push(automation);
              }
            }
          });
        }
      });
    });

    if (changeTriggersAutomation) {
      automationsToTrigger.map((automation) => {
        automation.triggerActions(context);
      });
    }
  };
}
