import Automator from "../Utils/AutomationHelper";
import { systemLog } from "../Utils/General";

const automation = new Automator("time")
  .every("second")
  .every("minute")
  .every("hour")
  .performs((context) => {
    systemLog(`Ding-dong! It's a new ${context.trigger}.`);
  });

export default automation;
