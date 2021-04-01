import { ActionInstance } from "..";
import { ActionStepType } from "../../Types";

export default (step: ActionStepType, actionInstance: ActionInstance) =>
  new Promise<void>(async (resolve, reject) => {
    const changeStream = actionInstance.action.server.models.db
      .collection("objects")
      .watch();
    changeStream.on("change", (change) => {
      if (change.operationType === "update") {
        const varMeta =
          actionInstance.action.action.data.vars[step.args.varName];
        const varToWatchFor = actionInstance.vars[step.args.varName];
        if (varMeta.type === "object") {
          const expectedState = step.args.object;
          const changeId = change.documentKey._id;
          if (changeId.toString() === varToWatchFor._id.toString()) {
            const object = change.updateDescription.updatedFields.data;
            let criteriaMet = true;
            expectedState.map((varCriteria) => {
              if (object[varCriteria.key] !== varCriteria.value) {
                criteriaMet = false;
              }
            });

            if (criteriaMet) {
              actionInstance.setVar(step.args.varName, {
                _id: changeId.toString(),
                objectId: varMeta.model,
                data: { ...change.updateDescription.updatedFields.data },
              });

              changeStream.close();
              resolve();
            }
          }
        }
      }
    });
  });
