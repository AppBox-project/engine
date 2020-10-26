import Automation from "../../Automation";
import Formula from "../../Formula";
import { ProcessInstance } from "../ProcessInstance";
import { set } from "lodash";
import DatabaseModel from "../../Classes/DatabaseModel";

/* * *
 * recalculate_formula
 * - modelKey
 * - fieldKey
 * Find a formula and recalculate ALL of the belonging objects' fields.
 * TODO: improve detection so only relevant formulas get recalculated.
 */

export default (instance: ProcessInstance) =>
  new Promise(async (resolve) => {
    const vars: vars = instance.variables;

    // Exit if variables are missing
    if (!vars.modelKey || !vars.fieldKey) {
      console.log(
        `Formula compilation action failed. Some variables were missing.`,
        vars
      );
      return;
    }

    const automation: Automation =
      instance.process.processVariables["automation"];
    const formula: Formula = automation.formula;
    const models: DatabaseModel = automation.models;

    // Step 1: create a list of objects with this formula
    const objects = await models.objects.model.find({
      objectId: vars.modelKey,
    });
    objects.reduce(async (prev, object) => {
      const data = object;
      // Step 2: compile formula
      // Follow relationships
      //@ts-ignore
      await formula.tags.reduce(async (prev, tag) => {
        if (tag.tag.match(/_r\./)) {
          const path = tag.tag.split(".");
          let nextObject = data;
          //@ts-ignore
          await path.reduce(async function (prev, curr) {
            let totalPath = (await prev) || "";
            if (curr.match("_r")) {
              const fieldName = curr.substr(0, curr.length - 2);
              const nextId = nextObject.data[fieldName];
              nextObject = await models.objects.model.findOne({
                _id: nextId,
              });
            } else {
              totalPath += `.${curr}`;
              data.data[totalPath] = nextObject.data[curr];
            }
            return totalPath;
          }, path[0]);
        }
        return data;
      }, formula.tags[0]);

      // Created complete object
      // Calculate and save
      const fieldName = formula.name.split("---")[1];
      object.data[fieldName] = await formula.calculate(data.data);
      object.markModified(`data.${fieldName}`);
      object.save();
    }, objects[0]);
  });

interface vars {
  modelKey?: string;
  fieldKey?: string;
}
