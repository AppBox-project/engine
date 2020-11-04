import { format, parseISO } from "date-fns";
import Formula from "../../Formula";

/*
 * dateFormat(date, format)
 * left: date
 * - Date to format
 * right: format
 * - String format
 * Calculates the difference between left and right according to date-fns.
 */
export default {
  execute: (fArgs, data, formula: Formula) =>
    new Promise((resolve) => {
      const date =
        typeof fArgs[0] == "string"
          ? typeof data[fArgs[0].trim()] === "string"
            ? parseISO(data[fArgs[0].trim()])
            : data[fArgs[0]]
          : fArgs[0];
      resolve(format(date, fArgs[1].trim()));
    }),
  onCompile: (fArguments) => {
    // Mark argument 0 as required
    return [fArguments[0].trim()];
  },
};
