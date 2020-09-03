// Attempt to read variables from a nunjucks formula since the library doesn't do that.
// Is quite imperfect, see https://regex101.com/r/dZp5cz/4
export const extractVariablesFromFormula = (text) => {
  const vars = [];
  var regex = new RegExp(
      /{{\s*(?:[a-zA-Z]*\()*((?:(?:[a-zA-Z_]|\.|-|\+|,|\s|))*)\)*\s*(?:\|.*)*\s*}}/g
    ),
    result;

  while ((result = regex.exec(text))) {
    if (result[1].match(/[-,+]/g)) {
      result[1].split(/[-,+]/g).map((o) => vars.push(o.trim()));
    } else {
      vars.push(result[1].trim());
    }
  }
  return vars;
};

export const turnVariablesIntoDependencyArray: (
  deps,
  model,
  models
) => Promise<{
  hasDayTrigger;
  dependencies;
}> = async (deps, model, models) =>
  new Promise(async (resolve, reject) => {
    let hasDayTrigger = false;
    const dependencies = [];
    await deps.reduce(async (prev, dependency) => {
      switch (dependency) {
        case "TODAY":
          hasDayTrigger = true;
          break;
        default:
          if (dependency.match("\\.")) {
            // This is a foreign dependency.
            // --> Loop through all the parts (split by .) and mark every field as a dependency for the appropriate model
            await dependency.split(".").reduce(async (promise, currentPart) => {
              const lastModel = await promise;
              const currentModel = lastModel || model;

              let fieldId;
              let nextModelId;
              if (currentPart.match("_r")) {
                fieldId = currentPart.replace("_r", "");
                nextModelId =
                  currentModel.fields[fieldId].typeArgs.relationshipTo;
              } else {
                fieldId = currentPart;
              }

              dependencies.push({
                model: currentModel.key,
                field: fieldId,
                foreign: model.key !== currentModel.key,
              });

              // Return current model for the next step
              return await models.objects.model.findOne({
                key: nextModelId,
              });
            }, undefined);
          } else {
            // This is a local dependency
            dependencies.push({
              model: model.key,
              field: dependency,
            });
          }
          break;
      }

      return dependency;
    }, deps[0]);

    resolve({ hasDayTrigger, dependencies });
  });
