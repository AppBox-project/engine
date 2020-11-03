import { ProcessInstance } from "../ProcessInstance";
import { ProcessStepAction } from "../ProcessStepAction";

// Wait
// -> Waits for n milliseconds, then resolves
export default (instance: ProcessInstance, action: ProcessStepAction) =>
  new Promise(async (resolve) => {
    console.log(
      `Instance ${instance.id} (${instance.process.name}) is waiting for ${action.args.timeout}ms.`
    );
    setTimeout(() => {
      console.log(
        `Instance ${instance.id} (${instance.process.name}) has finished waiting.`
      );
      resolve();
    }, action.args.timeout);
  });
