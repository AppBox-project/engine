export default {
  execute: () => {
    console.log("Executing differenceInYears");
  },
  onCompile: (fArguments) => {
    // Mark argument 0 and 1 as required
    return [fArguments[0], fArguments[1]];
  },
};
