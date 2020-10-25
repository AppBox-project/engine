type ActionType = "recalculate_formula";

export class ProcessStepAction {
  type: ActionType;

  constructor(type: ActionType) {
    this.type = type;
  }
}
