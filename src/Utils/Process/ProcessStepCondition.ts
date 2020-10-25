type actionIfTrue = "executeSteps" | "executeStepsAndNextStep" | undefined;
type actionIffalse = "nextStep" | "sendNotification" | undefined;
type potentialOutcomes =
  | "executeSteps"
  | "executeStepsAndNextStep"
  | "nextStep"
  | "sendNotification";

export class ProcessStepCondition {
  type: "always";
  actionIfTrue: actionIfTrue;
  actionIfFalse: actionIffalse;

  constructor(
    type: "always",
    actionIfTrue?: actionIfTrue,
    actionIfFalse?: actionIffalse
  ) {
    this.type = type;
    this.actionIfTrue = actionIfTrue;
    this.actionIfFalse = actionIfFalse;
  }

  evaluate = (args: {}) =>
    new Promise<potentialOutcomes>((resolve) => {
      let conditionResult;
      switch (this.type) {
        case "always":
          conditionResult = true;
          break;
        default:
          console.log(`Unknown condition action:`, this.type);
          break;
      }

      // Resolve the promise with the next step.
      resolve(
        conditionResult
          ? this.actionIfTrue || "executeSteps"
          : this.actionIfFalse || "nextStep"
      );
    });
}
