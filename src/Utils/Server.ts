import DatabaseModel from "./Classes/DatabaseModel";
import Automation from "./Automation";
import { map } from "lodash";
import { AutomationContext } from "appbox-formulas/dist/Types";
import Process from "./Process";
import { ProcessStep } from "./Process/ProcessStep";
import { ProcessStepCondition } from "./Process/ProcessStepCondition";
import { ProcessStepAction } from "./Process/ProcessStepAction";
import Task from "../Tasks";
var cron = require("node-cron");
var mongoose = require("mongoose");

/* * * SERVER * * *
 * The server is a helper class
 * It connects to the database and builds() all the indexes, processes and automations.
 */
export default class Server {
  models: DatabaseModel;
  whenReady;
  automations: { [key: string]: Automation } = {};
  processes: { [key: string]: Process } = {};
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

        // React to tasks that target engines.
        that.models.objects.stream.on("change", (change) => {
          if (change.operationType === "insert") {
            if (change.fullDocument.objectId === "system-task") {
              if (change.fullDocument.data.target === "Engine") {
                const databaseTask = change.fullDocument;
                const task = new Task(databaseTask, that.models, this);
                task.execute();
              }
            }
          }
        });

        resolve();
      });
    });
  }

  // Rebuild engine
  // --> Perform various tasks.
  // ---> Compile formulas
  rebuild = async () =>
    new Promise((resolve) => {
      console.log("--> Indexing engine tasks.");

      // Reset variables
      this.automations = {};
      this.processes = {};
      this.fieldTriggers = {};
      this.timeTriggers = {};

      // Perform all tasks
      Promise.all([this.compileFormulas(), this.compileProcesses()]).then(
        () => {
          this.compileCronTriggers();
          resolve();
        }
      );
    });

  // Compile formulas
  // --> Get all formula fields and compile them
  compileFormulas = () =>
    new Promise(async (resolve) => {
      console.log("--> 🧪 Compiling formulas...");

      const models = await this.models.models.model.find();

      await models.reduce(async (prev, model) => {
        const fields = Object.keys(model.fields);
        //@ts-ignore
        await fields.reduce(async (prevField, fieldKey) => {
          const field = model.fields[fieldKey];
          if (field.type === "formula") {
            const automationName = `${model.key}---${fieldKey}`;
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

            // After compiling formulas into automations, we take a look if any foreign relations exist.
            // Because of their (relative) complexity, foreign relations require processes
            // At this point we will make those processes.

            // Special deps are variables such as __TODAY that need a specific trigger.
            // EG: __TODAY needs to fire every day when the day changes.

            // Figure out if a formula is complex enough to require a process
            let requiresProcess = false;
            newAutomation.formula.dependencies.map((dep) => {
              if (dep.foreign) {
                // Create a new process
                const newProcess = new Process(automationName, models, this);
                // Add variables
                newProcess.addVariable({
                  required: true,
                  key: "modelKey",
                  name: "Model key",
                }); // Store the model key
                newProcess.addVariable({
                  required: true,
                  key: "fieldKey",
                  name: "Field key",
                }); // Store the model key
                // Add variables
                newProcess.addVariable({
                  required: true,
                  key: "context",
                  name: "Context",
                }); // Store the context

                newProcess.processVariables["automation"] = newAutomation; // Store the compiled formula
                // Add a step that finds affected objects and then calculates the formula
                newProcess.addStep(
                  new ProcessStep(
                    new ProcessStepCondition("always", "executeSteps"), // Always perform this step
                    [new ProcessStepAction("recalculate_formula")]
                  )
                );
                this.processes[automationName] = newProcess;
              }
            });

            // Formulas may have gotten time triggers (such as __TODAY). Create processes for these.
            newAutomation.formula.timeTriggers.map((timeTrigger) => {
              // Create a new process
              const newProcess = new Process(automationName, models, this);

              // Add variables
              newProcess.addVariable({
                required: true,
                key: "modelKey",
                name: "Model key",
              }); // Store the model key
              newProcess.addVariable({
                required: true,
                key: "fieldKey",
                name: "Field key",
              }); // Store the model key
              // Add variables
              newProcess.addVariable({
                required: true,
                key: "context",
                name: "Context",
              }); // Store the context

              newProcess.processVariables["automation"] = newAutomation; // Store the compiled formula
              // Add a step that finds affected objects and then calculates the formula
              newProcess.addStep(
                new ProcessStep(
                  new ProcessStepCondition("always", "executeSteps"), // Always perform this step
                  [new ProcessStepAction("recalculate_formula")]
                )
              );
              this.processes[automationName] = newProcess;
              if (!this.timeTriggers[timeTrigger])
                this.timeTriggers[timeTrigger] = [];
              this.timeTriggers[timeTrigger].push(automationName);
            });

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

  // Compile processes
  // --> Load all system-automations with type process and turn them into processes for engine
  compileProcesses = () =>
    new Promise(async (resolve) => {
      const processes = await this.models.objects.model.find({
        objectId: "system-automations",
        "data.type": "Process",
        "data.active": true,
      });

      console.log(
        `--> 👨‍💻 Compiling ${processes.length} ${
          processes.length === 1 ? "process" : "processes"
        }.`
      );

      await processes.reduce((prev, process) => {
        console.log(`--> 👨‍💻 Compiling '${process.data.name}'.`);
        const newProcess = new Process(process.data.name, this.models, this);
        process.data.data.triggers.map((trigger) => {
          switch (trigger.type) {
            case "cron":
              if (!this.timeTriggers[trigger.args.cron])
                this.timeTriggers[trigger.args.cron] = [];
              this.timeTriggers[trigger.args.cron].push(newProcess.id);
              break;
            default:
              console.log(`Unknown trigger type ${trigger.type}`);
              break;
          }
        });
        process.data.data.steps.map((step) => {
          const condition = new ProcessStepCondition(
            step.condition.conditions[0].type, // Todo: multiple conditions need to be processed seperately
            step.condition.conditions.actionIfTrue,
            step.condition.conditions.actionIfFalse
          );
          const actions: ProcessStepAction[] = [];
          step.actions.map((action) => {
            actions.push(
              new ProcessStepAction(action.type, action.args, action.name)
            );
          });
          newProcess.addStep(new ProcessStep(condition, actions));
        });
        this.processes[newProcess.id] = newProcess;
        return true;
      }, processes[0]);

      resolve();
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
              `data.${dependency.field}` === updateKey || // Or we're a field match.
              dependency.field === updateKey // This is for inserts
            ) {
              if (dependency.foreign) {
                // Foreign dependency are a tad more complicated and require a process instead of an automation.
                // When a formula dependency is marked as foreign, we created a process for it during rebuild().
                // Call it by the same name as the automation.
                this.processes[automation.name].start({
                  modelKey: automation.name.split("---")[0],
                  fieldKey: automation.name.split("---")[1],
                  context,
                }); // Start process, given the required arguments
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

  compileCronTriggers = () => {
    map(this.timeTriggers, (processIds, cronString) => {
      cron.schedule(cronString, () => {
        console.log(`CRON rule ${cronString} has triggered.`);

        processIds.map((processId) => {
          const process = this.processes[processId];
          const context: AutomationContext = {
            server: this,
            change: null,
            dbAction: null,
            object: null,
          };
          console.log(`👨‍💻 Process '${process.name}' has triggered (time).`);
          process.start({
            modelKey: processId.split("---")[0],
            fieldKey: processId.split("---")[1],
            context,
          });
        });
      });
    });
  };
}
