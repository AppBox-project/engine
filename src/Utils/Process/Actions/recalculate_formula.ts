import Automation from "../../Automation";
import Formula from "appbox-formulas";
import { ProcessInstance } from "../ProcessInstance";
import { DatabaseModel } from "appbox-types";
import { AutomationContext } from "appbox-formulas/dist/Types";
import { ProcessStepAction } from "../ProcessStepAction";

/* * *
 * recalculate_formula
 * - modelKey
 * - fieldKey
 * Find a formula and recalculate ALL of the belonging objects' fields.
 * TODO: improve detection so only relevant formulas get recalculated.
 */

export default (instance: ProcessInstance, action: ProcessStepAction) =>
  new Promise(async (resolve) => {
    const vars: vars = instance.variables;

    // Exit if variables are missing
    if (!vars.modelKey || !vars.fieldKey || !vars.context) {
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
      const data = await object;

      // Step 2: compile formula
      // Follow relationships
      //@ts-ignore
      await formula.tags.reduce(async (prev, tag) => {
        if (tag.tag.match(/_r\./)) {
          data.data[tag.tag] = await formula.getForeignFieldFromId(
            tag.tag,
            data
          );
        }
        return data;
      }, formula.tags[0]);

      // Created complete object
      // Calculate and save
      const fieldName = formula.name.split("---")[1];
      vars.context.object = data;
      object.data[fieldName] = await formula.calculate(data.data, vars.context);
      object.markModified(`data.${fieldName}`);
      return await object.save();
    }, objects[0]);
    resolve();
  });

interface vars {
  modelKey?: string;
  fieldKey?: string;
  context?: AutomationContext;
}
