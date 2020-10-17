import { systemLog } from "../General";
import { AutomationContextType } from "../Types";
import {
  extractVariablesFromFormula,
  turnVariablesIntoDependencyArray,
} from "../Formulas/GetVariables";
import { set } from "lodash";
import Nunjucks from "./Nunjucks";
import { correctDataType } from "./DataTransformation";

let nunjucks;

// Recalculate a formula
const calculate = async (context: AutomationContextType) => {
  if (!nunjucks) {
    nunjucks = new Nunjucks(context.models);
  }
  if (context.trigger === "change") {
    // Local change
    // A change in a formula that only references itself and can therefore only update itself.
    systemLog(
      `Local change in object ${context.object._id}. Recalculating formula ${context.id}.`
    );
    parseFormula(context.id, context.object, context.model, context.models);
  } else if (context.trigger === "foreignChange") {
    // A foreign change is a change that happened on a formula value with a relationship model. This can impact many objects.
    systemLog(
      `Foreign change in object ${context.object._id}. Recalculating formula ${context.id}.`
    );

    // Todo: currently recalculates all objects. In theory it should be possible to backtrace this to only the affected objects. Not an easy improvement, but definitely worth it.
    const objectId = context.id.split(".")[1];
    const objects = await context.models.objects.model.find({ objectId });
    const model = await context.models.models.model.findOne({ key: objectId });
    objects.map((object) => {
      parseFormula(context.id, object, model, context.models);
    });
  } else if (context.trigger === "foreignCountChange") {
    const foreignModel = context.model;
    const localModel = await context.models.models.model.findOne({
      key: context.id.split(".")[1],
    });
    const fieldId = context.id.split(".")[2];
    const field = localModel.fields[fieldId];
    const formula = field.typeArgs?.formula;

    const formulaArguments = formula.split("count_related(")[1].split(",");
    const countObj = formulaArguments[0].replace(/[^a-zA-Z_-]/gm, "");
    const countField = formulaArguments[1].replace(/[^a-zA-Z_-]/gm, "");
    formulaArguments.splice(0, 2);
    const filter = JSON.parse(
      `${formulaArguments.join(",").split("}]")[0]}}]`.replace("'", '"')
    );

    const localObject = await context.models.objects.model.findOne({
      _id: context.object.data[countField],
    });

    // Already execute count
    let count = 0;
    const query = await context.models.objects.model.find({
      objectId: countObj,
      [`data.${countField}`]: context.object.data[countField],
    });
    query.map((obj) => {
      let matches = false;
      filter.map((f) => {
        switch (f.operator) {
          case "equals":
            if (obj.data[f.field] === f.value) {
              matches = true;
            }
            break;
          default:
            break;
        }
      });
      if (matches) count++;
    });
    localModel.fields[fieldId].typeArgs.formula = formula.replace(
      /{{\W*count_related\(.*\)\W*}}/gm,
      count
    );
    parseFormula(context.id, localObject, localModel, context.models);
  } else {
    // Time trigger
    systemLog("Formula recalculation triggered by time.");

    // When triggered by time we have to change all the objects in a model.
    const objectId = context.id.split(".")[1];
    const objects = await context.models.objects.model.find({ objectId });
    const model = await context.models.models.model.findOne({ key: objectId });
    objects.map((object) => {
      parseFormula(context.id, object, model, context.models);
    });
  }
};

const parseFormula = async (id, object, model, models) => {
  const fieldId = id.split(".")[2];
  const field = model.fields[fieldId];
  const formula = field.typeArgs?.formula;

  // Extract dependencies from formula
  const variables = extractVariablesFromFormula(formula);
  // Turn dependencylist into a {model, object}[] list.
  const dependencies = await (
    await turnVariablesIntoDependencyArray(variables, model, models)
  ).dependencies;

  // Create data model for nunjucks
  let data = {}; // default constants

  // Now parse variables
  await variables.reduce(async (previous, variable) => {
    if (variable.match(/\./)) {
      // Foreign variable, follow the path
      const varParts = variable.split(".");
      let newValue;
      await varParts.reduce(async (previous, part) => {
        const previousObject = await previous;

        let newId = null;
        if (part.match("_r")) {
          newId = previousObject.data[part.replace("_r", "")];
        } else {
          newValue = previousObject.data[part];
        }

        return models.objects.model.findOne({ _id: newId });
      }, object);
      // We've traversed the formula and gotten a value.
      set(data, variable, newValue);
    } else {
      // Local variable
      data[variable] = correctDataType(
        object.data[variable],
        model.fields[variable]?.type || "text"
      );
    }
  }, variables[0]);
  data["TODAY"] = new Date();

  var parsedFormula = nunjucks.engine.renderString(
    field.typeArgs?.formula || "Error: formula missing",
    data
  );

  // Formula parsed
  switch (field.typeArgs?.type) {
    case "number":
      parsedFormula = parsedFormula !== "NaN" ? parseInt(parsedFormula) : 0;
      break;
    case "boolean":
      parsedFormula = parsedFormula === "true";
      break;
    default:
      break;
  }

  const newObject = await models.objects.model.findOne({
    _id: object._id,
  });
  newObject.data[fieldId] = parsedFormula;
  newObject.markModified(`data.${fieldId}`);
  newObject.save();
};

export default calculate;
