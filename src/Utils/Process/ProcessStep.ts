import { ProcessStepAction } from "./ProcessStepAction";
import { ProcessStepCondition } from "./ProcessStepCondition";

export class ProcessStep {
  conditions: ProcessStepCondition[];
  actions: ProcessStepAction[];

  constructor(
    conditions: ProcessStepCondition[],
    actions: ProcessStepAction[]
  ) {
    this.conditions = conditions;
    this.actions = actions;
  }
}
