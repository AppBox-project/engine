import scriptAutomations from "./Automations";
import { systemLog } from "./Utils/General";
import { map, find } from "lodash";
import { AutomationType } from "./Utils/Types";
import Automator from "./Utils/AutomationHelper";
import calculate from "./Utils/Formulas/Calculate";
import { InsertObject } from "./Automations/Actions/InsertObject";
import { UpdateCurrentObject } from "./Automations/Actions/UpdateCurrentObject";
import { DeleteObjects } from "./Automations/Actions/DeleteObjects";
import {
  extractVariablesFromFormula,
  turnVariablesIntoDependencyArray,
} from "./Utils/Formulas/GetVariables";
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

systemLog("Kickstarting engine..");

// Variables
let automations = {};
let secondTriggers = [];
let minuteTriggers = [];
let hourTriggers = [];
let dayTriggers = [];
let weekTriggers = [];
let monthTriggers = [];
let yearTriggers = [];
let customTimeTriggers = {};
let changeTriggers = [];
let automationChangeTriggers = [];
let cronJobs: {} = {};
let models;

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
  // --> Such as:
  models.entries.stream.on("change", (dbChange) => {
    changeTriggers.map(async (automationId) => {
      const automation: AutomationType = find(
        automations,
        (o: AutomationType) => o.id === automationId || o.id === automationId.id
      );

      // If this change hits a dependency, execute the automation
      if (
        dbChange.operationType === "update" ||
        dbChange.operationType === "insert"
      ) {
        const object = await models.entries.model.findOne({
          _id: dbChange.documentKey?._id,
        });

        let changeIsDependency = false;
        let changeIsForeign: Boolean = false;
        // Todo: this loops quite a lot. Could probably be improved.
        automationId.dependencies.map((dep) => {
          if (object.objectId === dep.model) {
            // An object of the right model was updated
            if (dep.field === "_ANY_") {
              if (!dep.fieldNot) {
                // Any field is okay
                changeIsDependency = true;
                if (dep.foreign) changeIsForeign = true;
              } else {
                // Any field except
                map(
                  dbChange.operationType === "update"
                    ? dbChange.updateDescription.updatedFields.data ||
                        dbChange.updateDescription.updatedFields // if an update doesn't mark the entire data object as changed, the fields get presented flat (data.fieldname)
                    : dbChange.fullDocument.data, // In case of an insert, loop the entire document
                  (newValue, fieldKey) => {
                    if (fieldKey.replace("data.", "") !== dep.fieldNot) {
                      // We also updated the right field
                      changeIsDependency = true;
                      if (dep.foreign) changeIsForeign = true;
                    }
                  }
                );
              }
            } else {
              map(
                dbChange.operationType === "update"
                  ? dbChange.updateDescription.updatedFields.data ||
                      dbChange.updateDescription.updatedFields // if an update doesn't mark the entire data object as changed, the fields get presented flat (data.fieldname)
                  : dbChange.fullDocument.data, // In case of an insert, loop the entire document
                (newValue, fieldKey) => {
                  if (fieldKey.replace("data.", "") === dep.field) {
                    // We also updated the right field
                    changeIsDependency = true;
                    if (dep.foreign) changeIsForeign = true;
                  }
                }
              );
            }
          }
        });

        // If we changed a field that is a dependency
        if (changeIsDependency) {
          const model = await models.objects.model.findOne({
            key: object.objectId,
          });
          executeAutomation(automation, {
            trigger: changeIsForeign ? "foreignChange" : "change",
            object,
            model,
            change: dbChange,
            id: automationId,
          });
        }
      }
    });

    // Now we'll process automations (insert, update or insertOrUpdate)

    map(automationChangeTriggers, (trigger, key) => {
      switch (dbChange.operationType) {
        case "insert":
          if (trigger.type === "insert") {
            let criteriaMet = false;
            if (dbChange.fullDocument.objectId === trigger.args.model) {
              criteriaMet = true;
              map(trigger.args.fields || [], (value, key) => {
                if (dbChange.fullDocument.data[key] !== value) {
                  criteriaMet = false;
                }
              });
            }

            if (criteriaMet) {
              executeAutomation(trigger.automation, {
                change: dbChange,
                trigger,
              });
            }
          }
          break;
        default:
          //This shouldn't occur after adding update and delete systemLog(`Unknown operationtype: ${dbChange.operationType}`);
          break;
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
  automationChangeTriggers = [];

  // Source 1: Read files from /Automations folder
  scriptAutomations.map((automation) => {
    systemLog(
      `Bootup -> Registering automation from included files: '${automation.id}'`
    );
    automations[automation.id] = automation;
    addTrigger(automation);
  });

  // Source 2: Read from database
  models.entries.model
    .find({ objectId: "automations", "data.active": true })
    .then((dbAutomations) => {
      dbAutomations.map((dbAutomation) => {
        systemLog(
          `Bootup -> Registering automation from database: '${dbAutomation.data.name}' (${dbAutomation.data.key})`
        );
        const automation = new Automator(dbAutomation.data.key);

        (dbAutomation.data.triggers || []).map((trigger) => {
          if (
            trigger.trigger === "insert" ||
            trigger.trigger === "update" ||
            trigger.trigger === "insertOrUpdate"
          ) {
            trigger.args = JSON.parse(trigger.args);
            automation.automationTriggers.push(trigger);
          } else {
            automation.every(trigger.trigger);
          }
        });
        (dbAutomation.data.actions || []).map((action) => {
          automation.runsAction({ ...action, arguments: action.args });
        });

        addTrigger(automation);
      });
    });

  // Find and compile formulas
  // -> Loop through all models and their fields
  // --> Find fields that are formulas
  // --> Read their dependency. Set change dependencies for fields, time dependencies for time constants
  systemLog("Bootup -> Compiling formulas...");
  const modelList = await models.objects.model.find({});
  await modelList.reduce(async (previous, model) => {
    const keys = Object.keys(model.fields);
    //@ts-ignore
    await keys.reduce(async (_previous, fieldKey) => {
      const field = model.fields[fieldKey];

      if (field.type === "formula") {
        // Compile formula
        // Extract dependencies
        const formula = field.typeArgs.formula;
        let hasDayTrigger = false;
        const formulaId = `f.${model.key}.${fieldKey}`;
        systemLog(`Compiling ${formulaId}...`);
        automations[formulaId] = new Automator(formulaId).performs(
          (context) => {
            calculate(context);
          }
        );

        // Extract dependencies from formula
        const deps = extractVariablesFromFormula(formula);

        // Turn dependencylist into a {model, object}[] list.
        const result = await turnVariablesIntoDependencyArray(
          deps,
          model,
          models
        );
        hasDayTrigger = result.hasDayTrigger;

        const dependencies = result.dependencies;

        // At this point we are sure that all the synchronous and asyncronous tasks are completed.
        // The var dependencies is now an array that can be added to changeTriggers.
        // If >0 dependencies, we need a change trigger
        if (dependencies.length > 0) {
          changeTriggers.push({
            id: formulaId,
            dependencies: dependencies,
          });
        }
        // If we have a day trigger (TODAY was used as a var), then fire every day.
        if (hasDayTrigger) {
          dayTriggers.push({
            id: formulaId,
            dependencies: dependencies,
          });
        }
        return "Test";
      }
    }, keys[0]);

    return model;
  }, modelList[0]);

  // Todo: the above logic is supposed to wait until it's done, then fire the rest of the script.
  // For unknown reasons, this isn't working. We instead set a timeout for 10 seconds because it should be done by then.
  setTimeout(() => {
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
        systemLog("Time trigger: second");
        secondTriggers.map((automationId) => {
          const automation: AutomationType = find(
            automations,
            (o: AutomationType) =>
              o.id === automationId || o.id === automationId.id
          );
          executeAutomation(automation, { trigger: "second" });
        });
      });
    }

    // Minute
    if (minuteTriggers.length > 0) {
      cronJobs["minute"] = cron.schedule("* * * * *", () => {
        systemLog("Time trigger: minute");
        minuteTriggers.map((automationId) => {
          const automation: AutomationType = find(
            automations,
            (o: AutomationType) =>
              o.id === automationId || o.id === automationId.id
          );
          executeAutomation(automation, { trigger: "minute" });
        });
      });
    }

    // Hour
    if (hourTriggers.length > 0) {
      cronJobs["hour"] = cron.schedule("0 * * * *", () => {
        systemLog("Time trigger: hour");
        hourTriggers.map((automationId) => {
          const automation: AutomationType = find(
            automations,
            (o: AutomationType) =>
              o.id === automationId || o.id === automationId.id
          );
          executeAutomation(automation, { trigger: "hour" });
        });
      });
    }

    // Day
    if (dayTriggers.length > 0) {
      cronJobs["day"] = cron.schedule("0 0 * * *", () => {
        systemLog("Time trigger: day");
        dayTriggers.map((automationId) => {
          const automation: AutomationType = find(
            automations,
            (o: AutomationType) =>
              o.id === automationId || o.id === automationId.id
          );
          executeAutomation(automation, { trigger: "day" });
        });
      });
    }

    // Week
    if (weekTriggers.length > 0) {
      cronJobs["week"] = cron.schedule("0 0 * * 0", () => {
        systemLog("Time trigger: week");
        weekTriggers.map((automationId) => {
          const automation: AutomationType = find(
            automations,
            (o: AutomationType) =>
              o.id === automationId || o.id === automationId.id
          );
          executeAutomation(automation, { trigger: "week" });
        });
      });
    }

    // Month
    if (monthTriggers.length > 0) {
      cronJobs["month"] = cron.schedule("0 0 1 * *", () => {
        systemLog("Time trigger: month");
        monthTriggers.map((automationId) => {
          const automation: AutomationType = find(
            automations,
            (o: AutomationType) =>
              o.id === automationId || o.id === automationId.id
          );
          executeAutomation(automation, { trigger: "month" });
        });
      });
    }

    // Year
    if (yearTriggers.length > 0) {
      cronJobs["year"] = cron.schedule("0 0 1 1 *", () => {
        systemLog("Time trigger: year");
        yearTriggers.map((automationId) => {
          const automation: AutomationType = find(
            automations,
            (o: AutomationType) =>
              o.id === automationId || o.id === automationId.id
          );
          executeAutomation(automation, { trigger: "year" });
        });
      });
    }

    // Custom CRON
    if (customTimeTriggers !== {}) {
      map(customTimeTriggers, (triggerAutomations, trigger) => {
        cronJobs[trigger] = cron.schedule(trigger, () => {
          systemLog(`Time trigger: Custom (${trigger})`);
          //@ts-ignore
          triggerAutomations.map((automationId) => {
            const automation: AutomationType = find(
              automations,
              (o: AutomationType) =>
                o.id === automationId || o.id === automationId.id
            );
            executeAutomation(automation, { trigger: "custom" });
          });
        });
      });
    }

    systemLog("Bootup -> Done.");
  }, 5000);
};

const addTrigger = (automation) => {
  automations[automation.id] = automation;
  // Time based triggers
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
        if (typeof trigger === "object") {
          changeTriggers.push(trigger);
        } else {
          // Custom cron time triggers
          customTimeTriggers[trigger] = customTimeTriggers[trigger] || []; // Make sure we have a value
          customTimeTriggers[trigger].push(automation.id);
        }

        break;
    }
  });

  // Automation event triggers
  map(automation.automationTriggers, (trigger) => {
    automationChangeTriggers.push({
      type: trigger.trigger,
      args: trigger.args,
      automation: automation,
    });
  });
};

const executeAutomation = (automation: AutomationType, context) => {
  if (automation.action) {
    // Option 1: normal action
    automation.action({ ...context, models, id: automation.id });
  } else {
    if (automation.simpleActions.length > 0) {
      // Option 2: list of simple actions
      const baseContext = { ...context, models, id: automation.id };
      automation.simpleActions.map((simpleAction) => {
        switch (simpleAction.type) {
          case "InsertObject":
            InsertObject(baseContext, simpleAction.arguments);
            break;
          case "DeleteObjects":
            DeleteObjects(baseContext, simpleAction.arguments);
            break;
          case "UpdateCurrentObject":
            UpdateCurrentObject(baseContext, simpleAction.arguments);
            break;
          default:
            systemLog(`Unknown simple action type ${simpleAction.type}`);
            break;
        }
      });
    } else {
      // Todo: process
      systemLog(`automation ${automation.id} triggered, but no actions found.`);
    }
  }
};
