import Formula from "../Formula";
import { AutomationContext } from "../Types";

export default async (formula: Formula, context: AutomationContext) => {
  const obj = await context.server.models.objects.model.findOne({
    _id: context.object._id,
  }); // Todo: this request can be removed.
  const fieldName = formula.name.split("---")[1];
  obj.data[fieldName] = await formula.calculate(context.object.data);
  obj.markModified(`data.${fieldName}`);
  obj.save();
};
