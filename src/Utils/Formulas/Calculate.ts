import { systemLog } from "../General";
import { AutomationContextType } from "../Types";
var nunjucks = require("nunjucks");
import { format, formatDistance, formatRelative, subDays } from "date-fns";

let env = nunjucks.configure();
env.addFilter("date", (date, dateFormat) => {
  return format(date, dateFormat);
});
env.addFilter("years", (time) => {
  return time / 31536000000;
});

// Recalculate a formula
const calculate = async (context: AutomationContextType) => {
  if (context.trigger === "change") {
    systemLog("Formula recalculation triggered by change.");
    const fieldId = context.id.id.split(".")[2];
    const field = context.model.fields[fieldId];

    // Todo: remote data
    // Create data model for nunjucks
    const data = { TODAY: new Date() }; // default constants

    context.id.dependencies.map((dep) => {
      let newVal = context.object.data[dep.field];
      switch (context.model.fields[dep.field].type) {
        case "date":
          newVal = new Date(newVal); // Convert date stored as string
          break;
        default:
          break;
      }
      data[dep.field] = newVal;
    });

    var parsedFormula = env.renderString(
      field.typeArgs?.formula || "Error: formula missing",
      data
    );
    switch (field.typeArgs.type) {
      case "number":
        parsedFormula = parseInt(parsedFormula);
        break;
      default:
        break;
    }

    const model = await context.models.entries.model.findOne({
      _id: context.object._id,
    });
    model.data[fieldId] = parsedFormula;
    model.markModified("data");
    model.save();
  } else {
    // Time trigger
    systemLog("Formula recalculation triggered by time.");
  }
};

export default calculate;
