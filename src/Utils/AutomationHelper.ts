import { systemLog } from "./General";
import { TimeTrigger, AutomationContextType, SimpleAction } from "./Types";

export default class Automator {
  // Defaults
  id: any; // unique identifier
  triggers: (string | {})[] = []; // List of event triggers
  simpleActions: SimpleAction[] = [];
  action: (context: AutomationContextType) => void;

  constructor(id) {
    this.id = id;
  }

  // Time based automations
  every = (trigger: TimeTrigger) => {
    this.triggers.push(trigger);
    return this;
  };

  // Change based automations
  whenObjectChanges = (
    dependencies: { model: string; field: string; fieldNot?: string }[]
  ) => {
    this.triggers.push({
      id: this.id,
      dependencies,
    });
    return this;
  };

  // Register actions
  performs = (action: (context: AutomationContextType) => void) => {
    this.action = action;
    return this;
  };

  // Register a simple action
  runsAction = (action: SimpleAction) => {
    this.simpleActions.push(action);
    return this;
  };
}
