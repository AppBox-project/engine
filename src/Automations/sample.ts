import Automator from "../Utils/AutomationHelper";
import { systemLog } from "../Utils/General";

export default new Automator("sample").every("second").perform((arg) => {
  systemLog(`Now this is automating`);
});
