import Automator from "../Utils/AutomationHelper";

const automation = new Automator("test")
  .whenObjectChanges([
    { model: "tests", field: "_ANY_", fieldNot: "times_updated" },
  ])
  .runsAction({
    type: "UpdateCurrentObject",
    arguments: {
      update: { times_updated: "{{times_updated|int + 1}}" },
    },
  });

export default automation;
