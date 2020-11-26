import { ProcessInstance } from "../ProcessInstance";
import { ProcessStepAction } from "../ProcessStepAction";

// DeleteObjects
// -> Takes an argument of 'DeleteObjects' and will create that object. DeleteObjects has model (string) and object (json)
export default (instance: ProcessInstance, action: ProcessStepAction) =>
  new Promise<void>(async (resolve) => {
    const args = JSON.parse(action.args.DeleteObjects);
    console.log(
      `Instance ${instance.id} (${instance.process.name}) will delete from ${args.model}.`
    );
    const deleteCriteria = {};
    args.object.map((filter) => {
      if (filter.operator === "equals") {
        deleteCriteria[`data.${filter.key}`] = filter.value;
      }
    });

    const result = await instance.process.models.objects.model.deleteMany(
      deleteCriteria
    );
    console.log(
      `Instance ${instance.id} (${instance.process.name}) deleted ${result.deletedCount} objects.`
    );

    resolve();
  });
