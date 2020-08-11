import { systemLog } from "../General";
import { AutomationContextType } from "../Types";
var nunjucks = require("nunjucks");

nunjucks.configure({ autoescape: true });

// Recalculate a formula
const calculate = (context: AutomationContextType) => {
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

    var parsedFormula = nunjucks.renderString(
      field.typeArgs?.formula || "Error: formula missing",
      data
    );

    console.log(parsedFormula, data);
  } else {
    // Time trigger
    systemLog("Formula recalculation triggered by time.");
  }
};

export default calculate;
