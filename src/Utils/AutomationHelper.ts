import { systemLog } from "./General";
import { TimeTrigger } from "./Types";

export default class Automator {
  id: any;
  triggers: string[] = [];
  action: (test: string) => void = () => {
    systemLog(`No action set.`);
  };

  constructor(id) {
    this.id = id;
  }

  // Time based automations
  every = (trigger: TimeTrigger) => {
    this.triggers.push(trigger);
    return this;
  };

  // Register actions
  perform = (action: (test: string) => void) => {
    this.action = action;
    console.log(" action set");

    return this;
  };
}
