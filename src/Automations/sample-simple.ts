import Automator from "../Utils/AutomationHelper";

const automation = new Automator("simple").every("minute").runsAction({
  type: "InsertObject",
  arguments: {
    type: "tests",
    object: { name: `Test` },
  },
});

export default automation;
