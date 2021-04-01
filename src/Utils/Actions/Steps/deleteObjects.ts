import { ActionInstance } from "..";
import { ActionStepType } from "../../Types";

export default (step: ActionStepType, actionInstance: ActionInstance) =>
  new Promise<void>(async (resolve, reject) => {
    if (step.args.mode === "free") {
      const deleteCriteria = { objectId: step.args.model };
      (step.args.newObject as { key: string; value: any }[]).map((crit) => {
        deleteCriteria[`data.${crit.key}`] = crit.value;
      });
      console.log("Deleting objects with criteria", deleteCriteria);
      await actionInstance.action.server.models.objects.model.deleteMany(
        deleteCriteria
      );
    } else {
      console.log("Todo: delete specific variable");
    }
  });
