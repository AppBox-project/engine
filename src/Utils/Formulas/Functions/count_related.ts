export default {
  execute: () => {
    console.log("Executing count_related");
  },
  onCompile: (fArguments) => {
    // Add a foreign relationship to the field key and add an additional field for each requirement ([2])
    const requirements = [];
    JSON.parse(fArguments[2]).map((dep) => {
      requirements.push({
        model: fArguments[0],
        field: dep.field,
        foreign: true,
      });
    });
    return [
      { model: fArguments[0], field: fArguments[1], foreign: true },
      ...requirements,
    ];
  },
};
