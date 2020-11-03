import Process from "../Process";
import { ProcessStep } from "./ProcessStep";
import { ProcessStepAction } from "./ProcessStepAction";
import actions from "./Actions";
const uniqid = require("uniqid");

/*
 * ProcessInstance
 * An instance is a version of a process meant to run.
 * Once it gets destroyed, it has variables and steps.
 * It executes everything in order and then destroys itself.
 * The process itself lives on.
 */
export class ProcessInstance {
  process: Process;
  id: string;
  variables: {};
  onDestroy: (id) => void;
  log: string[];

  constructor(process: Process, vars: {}, onDestroy: (id) => void) {
    this.process = process;
    this.id = uniqid();
    this.onDestroy = onDestroy;

    const variablesNotSupplied = [];
    this.process.variables.map((varMeta) => {
      if (varMeta.required) {
        if (!vars[varMeta.key]) {
          variablesNotSupplied.push(varMeta.name);
        }
      }
    });

    if (variablesNotSupplied.length > 0) {
      console.log(
        `A new instance of '${
          this.process.name
        }' could not be started; One or more required variables have not been supplied: ${variablesNotSupplied.join(
          ", "
        )};`,
        this.id
      );
      this.onDestroy(this.id);
    } else {
      // Everything is fine.
      this.variables = { ...this.variables, ...vars };
      this.evaluateStep(this.process.steps[0]);
    }
  }

  // evaluateStep(number)
  // --> Executes a step if criteria are met.
  evaluateStep = (step: ProcessStep) =>
    new Promise((resolve) => {
      // First evaluate the condition
      step.condition.evaluate({}).then((outcome) => {
        switch (outcome) {
          case "executeSteps":
            this.executeStep(step);
            break;
          case "executeStepsAndNextStep":
            this.executeStep(step);
            // Todo: next step
            break;
          default:
            console.log(`Unknown condition outcome`, outcome);
            break;
        }
      });
    });

  // executeStep(step)
  // --> Executes a step's actions
  executeStep = async (step: ProcessStep) => {
    await step.actions.reduce(
      //@ts-ignore
      async (prev, curr) => {
        await prev;
        return await this.executeAction(await curr);
      },
      step.actions[0]
    );
  };

  executeAction = (action: ProcessStepAction) =>
    new Promise(async (resolve, reject) => {
      if (action.type === "recalculate_formula") {
        await actions.recalculate_formula(this, action);
        resolve();
      } else if (action.type === "AddObject") {
        await actions.AddObject(this, action);
        resolve();
      } else if (action.type === "wait") {
        await actions.Wait(this, action);
        resolve();
      } else if (action.type === "DeleteObjects") {
        await actions.DeleteObjects(this, action);
        resolve();
      } else {
        console.error(`Unknown step action: ${action.type}`);
        resolve();
      }
    });
}
