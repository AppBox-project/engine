import { ProcessInstance } from "../ProcessInstance";
import { ProcessStepAction } from "../ProcessStepAction";

// AddObject
// -> Takes an argument of 'newObject' and will create that object. newObject has model (string) and object (json)
export default (instance: ProcessInstance, action: ProcessStepAction) =>
  new Promise(async (resolve) => {
    const args = JSON.parse(action.args.newObject);
    console.log(
      `Process '${instance.process.name}' inserts into ${args.model}.`
    );
    const newObject = new instance.process.models.objects.model({
      objectId: args.model,
      data: args.object,
    });
    await newObject.save();
  });
