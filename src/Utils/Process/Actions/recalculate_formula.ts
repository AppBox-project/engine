import Automation from "../../Automation";
import Formula from "../../Formula";
import { ProcessInstance } from "../ProcessInstance";
import { set, get } from "lodash";
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
    objects.map((object) => {
      const data = object.data;
      // Step 2: compile formula
      formula.tags.map((tag) => {
        if (tag.tag.match(/_r\./)) {
          const path = tag.tag.split(".");
          let totalPath = "";
          //@ts-ignore
          path.reduce(async function (prev, curr) {
            if (curr.match("_r")) {
              console.log(totalPath);
            }
            return curr;
          }, path[0]);
        }
      });
    });
  });

interface vars {
  modelKey?: string;
  fieldKey?: string;
}
