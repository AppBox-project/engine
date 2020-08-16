import { systemLog } from "../General";
import { AutomationContextType } from "../Types";
var nunjucks = require("nunjucks");
import { format } from "date-fns";
import { set } from "lodash";

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
    // Local change
    // A change in a formula that only references itself and can therefore only update itself.
    systemLog(
      `Local change in object ${context.object._id}. Recalculating formula ${context.id.id}.`
    );
    parseFormula(context.id, context.object, context.model, context.models);
  } else if (context.trigger === "foreignChange") {
    // A foreign change is a change that happened on a formula value with a relationship model. This can impact many objects.
    // Todo: currently recalculates all objects. In theory it should be possible to backtrace this to only the affected objects. This could be difficult.
    systemLog(
      `Foreign change in object ${context.object._id}. Recalculating formula ${context.id.id}.`
    );
    const modelId = context.id.id.split(".")[1];
    const fieldId = context.id.id.split(".")[2];

    // Todo: how to deal with a formula with multiple dependencies of which one foreign?
    // --> (needs improvement) loop through all objects and recalculate their formulas.
    context.models.entries.model.find({ objectId: modelId }).then((objects) => {
      objects.map(async (object) => {
        // For every object, split the formula
        const inf = await context.id.originalDependency
          .split(".")
          .reduce(async (promise, dependencyPart) => {
            const object = await promise;

            if (!object) return;

            if (dependencyPart.match("_r")) {
              return await context.models.entries.model.findOne({
                _id: object.data[dependencyPart.replace("_r", "")],
              });
            } else {
              return object.data[dependencyPart.replace("_r", "")];
            }
          }, await context.models.entries.model.findOne({ _id: object._id }));

        // We now have the value in inf
        // Create data model for nunjucks
        const data = {
          TODAY: new Date(),
        }; // default constants
        set(data, context.id.originalDependency, inf);

        const model = await context.models.objects.model.findOne({
          key: modelId,
        });
        const newObject = await context.models.entries.model.findOne({
          _id: object._id,
        });

        var parsedFormula = env.renderString(
          model?.fields[fieldId]?.typeArgs?.formula || "Error: formula missing",
          data
        );
        switch (model.fields[fieldId].typeArgs.type) {
          case "number":
            parsedFormula = parseInt(parsedFormula);
            break;
          case "boolean":
            parsedFormula = parsedFormula === "true";
            break;
          default:
            break;
        }

        newObject.data[fieldId] = parsedFormula;
        newObject.markModified(`data.${fieldId}`);
        newObject.save();
      });
    });
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
    case "boolean":
      parsedFormula = parsedFormula === "true";
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
