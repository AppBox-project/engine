import { differenceInYears, parseISO } from "date-fns";

/*
 * differenceInYears(left, right)
 * left: date
 * - Start date
 * right: date
 * - End date
 * Calculates the difference between left and right according to date-fns.
 */
export default {
  execute: (fArgs, data) =>
    new Promise((resolve) => {
      const left =
        typeof data[fArgs[0].trim()] === "string"
          ? parseISO(data[fArgs[0].trim()])
          : data[fArgs[0].trim()];
      const right =
        typeof data[fArgs[1].trim()] === "string"
          ? parseISO(data[fArgs[1].trim()])
          : data[fArgs[1].trim()];
      resolve(differenceInYears(left, right));
    }),
  onCompile: (fArguments) => {
    // Mark argument 0 and 1 as required
    return [fArguments[0].trim(), fArguments[1].trim()];
  },
};
