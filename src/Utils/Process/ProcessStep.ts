import { ProcessStepAction } from "./ProcessStepAction";
import { ProcessStepCondition } from "./ProcessStepCondition";

export class ProcessStep {
  condition: ProcessStepCondition;
  actions: ProcessStepAction[];

  constructor(condition: ProcessStepCondition, actions: ProcessStepAction[]) {
    this.condition = condition;
    this.actions = actions;
  }
}
