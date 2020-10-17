var n = require("nunjucks");
import { format } from "date-fns";
import { differenceInCalendarYears } from "date-fns";

export default class Nunjucks {
  models;
  engine;
  contextVars;
  setContextVars = (vars) => (this.contextVars = vars);

  constructor(models?) {
    if (models) this.models = models;
    this.engine = n.configure();
    this.engine.addGlobal("differenceInYears", (a, b) =>
      differenceInCalendarYears(new Date(a), new Date(b))
    );

    this.engine.addFilter("date", (date, dateFormat) =>
      format(date, dateFormat)
    );
    this.engine.addFilter("years", (time) => time / 31536000000);
  }
}
