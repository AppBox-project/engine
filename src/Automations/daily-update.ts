import Automator from "../Utils/AutomationHelper";

export default new Automator("daily-update").every("day").runsAction({
  type: "InsertObject",
  arguments: {
    type: "system-task",
    object: {
      type: "Box update",
      name: "Update software",
      description: "Triggered by the automator",
      when: "asap",
      action: "box-update",
      progress: 0,
      state: "Planned",
    },
  },
});
