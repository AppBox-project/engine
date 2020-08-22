import Automator from "../Utils/AutomationHelper";

export default new Automator("task-cleanup")
  .every("0 0 1 * * *") // at 1 am, so not at the same time as the daily update task
  .runsAction({
    type: "DeleteObjects",
    arguments: { type: "system-task", filter: { "data.done": true } },
  });
