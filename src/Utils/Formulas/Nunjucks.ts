var n = require("nunjucks");
import { format } from "date-fns";
let nunjucks = n.configure();
nunjucks.addFilter("date", (date, dateFormat) => {
  return format(date, dateFormat);
});
nunjucks.addFilter("years", (time) => {
  return time / 31536000000;
});
export default nunjucks;
