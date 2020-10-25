import DatabaseModel from "./Classes/DatabaseModel";
import { ProcessInstance } from "./Process/ProcessInstance";
import { ProcessStep } from "./Process/ProcessStep";
import { ModelType } from "./Types";

/* * * Process * * *
 * Processes are the more complex form of automations.
 * They follow multiple steps, have conditional logic and retain variables
 * They include (foreign) formula calculations
 */
interface variableMeta {
  required?: boolean;
  name: string;
  key: string;
  type?: "string";
}

export default class Process {
  name: string;
  model: ModelType;
  models: DatabaseModel;
  steps: ProcessStep[] = [];
  variables: variableMeta[] = []; // Execution variables are set per execution. Therefore this array contains it's meta information.
  processVariables = {}; // Process variables store values that are the same for all executions.
  instances: { [id: string]: ProcessInstance } = {};

  constructor(name: string, model: ModelType, models: DatabaseModel) {
    this.name = name;
    this.model = model;
    this.models = models;
  }

  addStep = (step: ProcessStep) => {
    this.steps.push(step);
  };

  addVariable = (varMeta: variableMeta) => {
    this.variables.push(varMeta);
  };

  start = (vars: {}) => {
    const newInstance = new ProcessInstance(this, vars, this.onDestroy); // Create a new instance
    this.instances[newInstance.id] = newInstance; // Save the instance.
  };

  onDestroy = (id) => {
    delete this.instances[id];
    console.log(`Instance ${id} destroyed.`, this.name);
  };
}
