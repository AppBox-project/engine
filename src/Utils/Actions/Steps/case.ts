import { ActionInstance } from "..";
import { ActionStepType } from "../../Types";
import steps from "./";

export default (step: ActionStepType, actionInstance: ActionInstance) =>
  new Promise<void>(async (resolve, reject) => {
    // Figure out what case to apply
    let caseIndex = 0;
    for (let x = 1; x < step.cases.length && caseIndex === 0; x++) {
      const caseMeta = step.cases[x];
      if (caseMeta.conditions.mode === "simple") {
        let criteriaMet = true;

        caseMeta.conditions.criteria.map((crit) => {
          const varToCheck = actionInstance.vars[crit.var];
          if (typeof crit.val === "object") {
            crit.val.map((objCrit) => {
              if (varToCheck.data[objCrit.key] !== objCrit.value) {
                criteriaMet = false;
              }
            });
          } else {
            if (varToCheck != crit.val) {
              criteriaMet = false;
            }
          }
        });

        if (criteriaMet) {
          caseIndex = x;
        }
      }
    }

    // Apply case actions
    const caseMeta = step.cases[caseIndex];
    console.log(`Case ${caseMeta.label} applied.`);

    await caseMeta.steps.reduce(
      //@ts-ignore
      async (prev, currentStep) => {
        await prev;
        // Turns out case is a reserved word
        if (currentStep.type === "case") currentStep.type = "Case";
        return await (steps[currentStep.type]
          ? steps[currentStep.type](currentStep, actionInstance)
          : new Promise<void>((resolve, reject) => {
              console.log(`Unknown step type ${currentStep.type}.`);
              resolve();
            }));
      },
      caseMeta.steps[0]
    );
    resolve();
    return this;
  });
