var n = require("nunjucks");
import { format } from "date-fns";
let nunjucks = n.configure();
import { differenceInYears } from "date-fns";

nunjucks.addGlobal("differenceInYears", differenceInYears);

nunjucks.addFilter("date", (date, dateFormat) => {
  return format(date, dateFormat);
});

nunjucks.addFilter("years", (time) => {
  console.log(time);

  return time / 31536000000;
});

export default nunjucks;
