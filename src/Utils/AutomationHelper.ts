import { systemLog } from "./General";
import { TimeTrigger, AutomationContextType, ChangeFilterType } from "./Types";

export default class Automator {
  // Defaults
  id: any; // unique identifier
  triggers: string[] = []; // List of event triggers
  changeFilter: ChangeFilterType; // condition (for change)
  action: (context: AutomationContextType) => void = () => {
    systemLog(`No action set.`);
  }; // Actions to perform

  constructor(id) {
    this.id = id;
  }

  // Time based automations
  every = (trigger: TimeTrigger | "change") => {
    this.triggers.push(trigger);
    return this;
  };

  // Set changeFilter
  where = (changeFilter: ChangeFilterType) => {
    this.changeFilter = changeFilter;
    return this;
  };

  // Register actions
  perform = (action: (context: AutomationContextType) => void) => {
    this.action = action;
    return this;
  };
}
