import Automator from "../Utils/AutomationHelper";

export default new Automator("auto-backup").every("week").runsAction({
  type: "InsertObject",
  arguments: {
    type: "system-task",
    object: {
      type: "Database export",
      name: "Weekly backup",
      description: "Triggered by the automator",
      when: "asap",
      action: "backup",
      progress: 0,
      state: "Planned",
    },
  },
});
