import scriptAutomations from "./Automations";
import { systemLog } from "./Utils/General";
import { map, find, replace } from "lodash";
import { AutomationType } from "./Utils/Types";
import automation from "./Automations/sample-time-automation";
import Automator from "./Utils/AutomationHelper";
import calculate from "./Utils/Formulas/Calculate";
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
let automations = {};
let secondTriggers = [];
let minuteTriggers = [];
let hourTriggers = [];
let dayTriggers = [];
let weekTriggers = [];
let monthTriggers = [];
let yearTriggers = [];
let changeTriggers = [];
let cronJobs = {};
let models;

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
  models = {
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
  // Todo: react appropriately to model changes
  models.entries.stream.on("change", (dbChange) => {
    changeTriggers.map(async (automationId) => {
      const automation: AutomationType = find(
        automations,
        (o: AutomationType) => o.id === automationId || o.id === automationId.id
      );
      // If this change hits a dependency, execute the automation
      if (dbChange.operationType === "update") {
        const object = await models.entries.model.findOne({
          _id: dbChange.documentKey?._id,
        });

        let changeIsDependency = false;
        // Todo: this loops quite a lot. Could probably be improved.
        automationId.dependencies.map((dep) => {
          if (object.objectId === dep.model) {
            // An object of the right model was updated
            map(
              dbChange.updateDescription.updatedFields.data,
              (newValue, fieldKey) => {
                if (fieldKey === dep.field) {
                  // We also updated the right field
                  changeIsDependency = true;
                }
              }
            );
          }
        });

        if (changeIsDependency) {
          const model = await models.objects.model.findOne({
            key: object.objectId,
          });
          automation.action({
            trigger: automationId.originalDependency
              ? "foreignChange"
              : "change",
            object,
            model,
            models,
            change: dbChange,
            id: automationId,
          });
        }
      }
    });
  });

  // Database initiated
  systemLog("Vroom! Engine started.");

  // Build automation database
  rebuildAutomations();
});

// This function rebuilds the automation database
const rebuildAutomations = async () => {
  systemLog("Rebuilding automations");
  // Reset
  automations = {};
  secondTriggers = [];
  minuteTriggers = [];
  hourTriggers = [];
  dayTriggers = [];
  weekTriggers = [];
  monthTriggers = [];
  yearTriggers = [];
  changeTriggers = [];

  // Todo: parse scripts
  // Read files from /Automations folder
  scriptAutomations.map((automation) => {
    automations[automation.id] = automation;
    addTrigger(automation);
  });

  // Find and compile formulas
  // -> Loop through all models and their fields
  // --> Find fields that are formulas
  // --> Read their dependency. Set change dependencies for fields, time dependencies for time constants
  systemLog("Compiling formulas...");
  const modelList = await models.objects.model.find({});
  modelList.map((model) => {
    map(model.fields, (field, fieldKey) => {
      if (field.type === "formula") {
        // Compile formula
        // Extract dependencies
        const formula = field.typeArgs.formula;
        const dependencies = [];
        let hasDayTrigger = false;
        const formulaId = `f.${model.key}.${fieldKey}`;
        automations[formulaId] = new Automator(formulaId).perform((context) => {
          calculate(context);
        });

        formula.split("{{").map((part) => {
          if (part.length > 2) {
            part
              .split("}}")[0]
              .split("|")[0]
              .replace("(", "")
              .replace(")", "")
              .trim()
              .split(/[ -]/)
              .map(async (variable) => {
                const dependency = variable.trim();
                if (dependency.length > 0) {
                  switch (dependency) {
                    case "TODAY":
                      hasDayTrigger = true;
                      break;
                    default:
                      if (dependency.match("\\.")) {
                        // This is a foreign dependency.
                        // --> Loop through all the parts (split by .) and mark every field as a dependency
                        await dependency
                          .split(".")
                          .reduce(async (promise, currentPart) => {
                            const lastModel = await promise;

                            let fieldId;
                            if (currentPart.match("_r")) {
                              fieldId = currentPart.replace("_r", "");
                            } else {
                              fieldId = currentPart;
                            }

                            dependencies.push({
                              model: lastModel ? lastModel.key : model.key,
                              field: fieldId,
                            });

                            // Return current model for the next step
                            return await models.objects.model.findOne({
                              key: fieldId,
                            });
                          }, undefined);

                        // We have to do this here because of the asynchronous nature of database requests
                        if (dependencies.length > 0) {
                          changeTriggers.push({
                            id: formulaId,
                            dependencies: dependencies,
                            originalDependency: dependency,
                          });
                        }
                      } else {
                        // This is a local dependency
                        dependencies.push({
                          model: model.key,
                          field: dependency,
                        });
                      }
                      break;
                  }
                }
              });
          }
        });
        // If >0 dependencies, we need a change trigger
        if (dependencies.length > 0) {
          changeTriggers.push({
            id: formulaId,
            dependencies: dependencies,
          });
        }
        if (hasDayTrigger) {
          dayTriggers.push({
            id: formulaId,
            dependencies: dependencies,
          });
        }
      }
    });
  });

  // Cancel all previously set cronjobs (make sure no cron is planned without being neccessary)
  if (cronJobs["second"]) cronJobs["second"].destroy();
  if (cronJobs["minute"]) cronJobs["minute"].destroy();
  if (cronJobs["hour"]) cronJobs["hour"].destroy();
  if (cronJobs["day"]) cronJobs["day"].destroy();
  if (cronJobs["week"]) cronJobs["week"].destroy();
  if (cronJobs["month"]) cronJobs["month"].destroy();
  if (cronJobs["year"]) cronJobs["year"].destroy();

  // Set all cron jobs for timed based automations
  // Second
  if (secondTriggers.length > 0) {
    cronJobs["second"] = cron.schedule("* * * * * *", () => {
      systemLog("Cron second triggered");
      secondTriggers.map((automationId) => {
        const automation: AutomationType = find(
          automations,
          (o: AutomationType) =>
            o.id === automationId || o.id === automationId.id
        );
        automation.action({ trigger: "second", id: automationId, models });
      });
    });
  }

  // Minute
  if (minuteTriggers.length > 0) {
    cronJobs["minute"] = cron.schedule("* * * * *", () => {
      systemLog("Cron minute triggered");
      minuteTriggers.map((automationId) => {
        const automation: AutomationType = find(
          automations,
          (o: AutomationType) =>
            o.id === automationId || o.id === automationId.id
        );
        automation.action({ trigger: "minute", id: automationId, models });
      });
    });
  }

  // Hour
  if (hourTriggers.length > 0) {
    cronJobs["hour"] = cron.schedule("0 * * * *", () => {
      systemLog("Cron hour triggered");
      hourTriggers.map((automationId) => {
        const automation: AutomationType = find(
          automations,
          (o: AutomationType) =>
            o.id === automationId || o.id === automationId.id
        );
        automation.action({ trigger: "hour", id: automationId, models });
      });
    });
  }

  // Day
  if (dayTriggers.length > 0) {
    cronJobs["day"] = cron.schedule("0 0 * * *", () => {
      systemLog("Cron day triggered");

      dayTriggers.map((automationId) => {
        const automation: AutomationType = find(
          automations,
          (o: AutomationType) =>
            o.id === automationId || o.id === automationId.id
        );
        automation.action({ trigger: "day", id: automationId, models });
      });
    });
  }

  // Week
  if (weekTriggers.length > 0) {
    cronJobs["week"] = cron.schedule("0 0 * * 0", () => {
      systemLog("Cron week triggered");
      weekTriggers.map((automationId) => {
        const automation: AutomationType = find(
          automations,
          (o: AutomationType) =>
            o.id === automationId || o.id === automationId.id
        );
        automation.action({ trigger: "week", id: automationId, models });
      });
    });
  }

  // Month
  if (monthTriggers.length > 0) {
    cronJobs["month"] = cron.schedule("0 0 1 * *", () => {
      systemLog("Cron month triggered");
      monthTriggers.map((automationId) => {
        const automation: AutomationType = find(
          automations,
          (o: AutomationType) =>
            o.id === automationId || o.id === automationId.id
        );
        automation.action({ trigger: "month", id: automationId, models });
      });
    });
  }

  // Year
  if (yearTriggers.length > 0) {
    cronJobs["year"] = cron.schedule("0 0 1 1 *", () => {
      systemLog("Cron year triggered");
      yearTriggers.map((automationId) => {
        const automation: AutomationType = find(
          automations,
          (o: AutomationType) =>
            o.id === automationId || o.id === automationId.id
        );
        automation.action({ trigger: "year", id: automationId, models });
      });
    });
  }
};

const addTrigger = (automation) => {
  systemLog(`Processing trigger ${automation.id}`);
  automations[automation.id] = automation;
  map(automation.triggers, (trigger) => {
    switch (trigger) {
      case "second":
        secondTriggers.push(automation.id);
        break;
      case "minute":
        minuteTriggers.push(automation.id);
        break;
      case "hour":
        hourTriggers.push(automation.id);
        break;
      case "day":
        dayTriggers.push(automation.id);
        break;
      case "week":
        weekTriggers.push(automation.id);
        break;
      case "month":
        monthTriggers.push(automation.id);
        break;
      case "year":
        yearTriggers.push(automation.id);
        break;
      default:
        systemLog(`Unknown trigger type ${trigger}`);
        break;
    }
  });
};
