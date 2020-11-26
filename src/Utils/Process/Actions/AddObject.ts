import { ProcessInstance } from "../ProcessInstance";
import { ProcessStepAction } from "../ProcessStepAction";
import Formula from "appbox-formulas";

// AddObject
// -> Takes an argument of 'newObject' and will create that object. newObject has model (string) and object (json)
export default (instance: ProcessInstance, action: ProcessStepAction) =>
  new Promise<void>(async (resolve) => {
    const args = JSON.parse(action.args.newObject);
    console.log(
      `Process '${instance.process.name}' inserts into ${args.model}.`
    );

    // Parse formulas
    const newObject = {};
    const model = await instance.process.models.models.model.findOne({
      key: args.model,
    });
    //@ts-ignore
    await Object.keys(args.object).reduce(async (prev, key) => {
      await prev;
      const value = args.object[key];
      if (typeof value === "object") {
        // formula
        const formula = new Formula(
          value.formula,
          model,
          instance.process.models,
          instance.id
        );
        await formula.compile();
        newObject[key] = await formula.calculate(
          {},
          { server: instance.process.server }
        );
      } else {
        newObject[key] = value;
      }
      return key;
    }, Object.keys(args.object)[0]);

    await new instance.process.models.objects.model({
      objectId: args.model,
      data: newObject,
    }).save();
    resolve();
  });
