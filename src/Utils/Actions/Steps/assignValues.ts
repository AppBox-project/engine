import { ActionInstance } from "..";
import { ActionStepType } from "../../Types";
import Formula from "appbox-formulas";
const uniqid = require("uniqid");

export default (step: ActionStepType, actionInstance: ActionInstance) =>
  new Promise<void>(async (resolve, reject) => {
    await Object.keys(step.args).reduce(
      //@ts-ignore
      async (prevKey, currKey) => {
        await prevKey;
        const value = step.args[currKey];

        const v = actionInstance.action.action.data.vars[currKey];

        if (v.type === "object") {
          // Parse all formulas
          await Object.keys(value).reduce(
            //@ts-ignore
            async (prevValueKey, currValueKey) => {
              await prevValueKey;
              const currValue = value[currValueKey];

              if (currValue.formula) {
                const formula = new Formula(
                  currValue.formula,
                  undefined,
                  actionInstance.action.server.models,
                  uniqid()
                );
                await formula.compile();
                const result = await formula.calculate(actionInstance.vars, {
                  server: actionInstance.action.server,
                });
                value[currValueKey] = result;
              }

              return currValueKey;
            },
            Object.keys(value)[0]
          );
          actionInstance.setVar(currKey, { data: value, objectId: v.model });
        } else {
          actionInstance.setVar(currKey, value);
        }
        return currKey;
      },
      Object.keys(step.args)
    );

    resolve();
  });
