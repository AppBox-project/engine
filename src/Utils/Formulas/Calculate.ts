import Formula from "appbox-formulas";
import { AutomationContext } from "appbox-formulas/dist/Types";

export default async (formula: Formula, context: AutomationContext) => {
  const obj = await context.models.objects.model.findOne({
    _id: context.object._id,
  }); // Todo: this request can be removed.
  const fieldName = formula.name.split("---")[1];
  obj.data[fieldName] = await formula.calculate(context.object.data, context);
  obj.markModified(`data.${fieldName}`);
  obj.save();
};
