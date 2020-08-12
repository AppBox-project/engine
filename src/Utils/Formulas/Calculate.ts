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
    parseFormula(context.id, context.object, context.model, context.models);
  } else if (context.trigger === "foreignChange") {
    systemLog("Foreign change occured");
    console.log(context.id.id);
  } else {
    // Time trigger
    systemLog("Formula recalculation triggered by time.");
    // When triggered by time we have got to change all the models.
    const objectId = context.id.id.split(".")[1];
    const objects = await context.models.entries.model.find({ objectId });
    const model = await context.models.objects.model.findOne({ key: objectId });
    objects.map((object) => {
      parseFormula(context.id, object, model, context.models);
    });
  }
};

const parseFormula = async (id, object, model, models) => {
  const fieldId = id.id.split(".")[2];
  const field = model.fields[fieldId];

  // Todo: remote data
  // Create data model for nunjucks
  const data = { TODAY: new Date() }; // default constants

  id.dependencies.map((dep) => {
    let newVal = object.data[dep.field];
    switch (model.fields[dep.field].type) {
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

  const newObject = await models.entries.model.findOne({
    _id: object._id,
  });
  newObject.data[fieldId] = parsedFormula;
  newObject.markModified(`data.${fieldId}`);
  newObject.save();
};

export default calculate;
