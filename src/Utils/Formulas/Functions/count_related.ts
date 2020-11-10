import { AutomationContext, FormulaContext } from "../../Types";
import Formula from "../../Formula";

/*
 * count_related(left, right)
 * model: string
 * - The model to look for
 * field: string
 * - The field this object is connected to
 * Counts the amount of objects the current object is related to.
 */

export default {
  execute: (
    fArgs,
    data,
    formula: Formula,
    context: AutomationContext | FormulaContext
  ) =>
    new Promise(async (resolve, reject) => {
      //@ts-ignore
      if (!context.object) {
        reject("This formula is ran without object context ");
      } else {
        const modelKey = fArgs[0];
        const fieldKey = fArgs[1];
        const criteria = {};

        JSON.parse(fArgs[2]).map(
          (crit) => (criteria[`data.${crit.field}`] = crit.value)
        );

        const result = await formula.models.objects.model.countDocuments({
          objectId: modelKey,
          //@ts-ignore
          [`data.${fieldKey}`]: context.object._id.toString(),
          ...criteria,
        });
        resolve(result);
      }
    }),
  onCompile: (fArguments) => {
    // Add a foreign relationship to the field key and add an additional field for each requirement ([2])
    const requirements = [];
    JSON.parse(fArguments[2]).map((dep) => {
      requirements.push({
        model: fArguments[0],
        field: dep.field,
        foreign: true,
      });
    });
    return [
      { model: fArguments[0], field: fArguments[1], foreign: true },
      ...requirements,
    ];
  },
};
