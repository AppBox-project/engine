type ActionType =
  | "recalculate_formula"
  | "AddObject"
  | "DeleteObjects"
  | "wait";

export class ProcessStepAction {
  type: ActionType;
  args: any;
  name: string;

  constructor(type: ActionType, args?: any, name?: string) {
    this.type = type;
    this.args = args;
    this.name = name;
  }
}
