import { AutomationContext, ModelType } from "./Types";
import DatabaseModel from "./Classes/DatabaseModel";
import Formula from "./Formula";
import calculate from "./Formulas/Calculate";

/*
 * * * AUTOMATION * * *
 * Automations are simple IFTTT actions
 * They include (local) formula calculations
 */
export default class Automation {
  name: string;
  formula?: Formula;
  model: ModelType;
  models: DatabaseModel;
  actions: { type: "formula_calculate"; args?: {} }[] = [];
  dependencies: { model: string; field: string; foreign: boolean }[] = [];

  constructor(name: string, model: ModelType, models: DatabaseModel) {
    this.name = name;
    this.model = model;
    this.models = models;
  }

  // Add and compile formula
  // - The server will find formulas and create automations for them.
  // - This function compiles the formula
  compileFormula = (formula: string, fieldKey: string) =>
    new Promise(async (resolve) => {
      this.formula = new Formula(formula, fieldKey, this.model, this.models);
      await this.formula.compile();
      this.actions.push({ type: "formula_calculate" });
      this.dependencies = this.formula.dependencies;
      resolve();
    });

  // Trigger actions
  // - Runs actions contained within this automation
  triggerActions = (context: AutomationContext) => {
    console.log(`${this.name} triggered.`);
    this.actions.map((action) => {
      switch (action.type) {
        case "formula_calculate":
          calculate(this.formula, context);
          break;
        default:
          console.log(
            `Automation ${this.name} tries to run an unknown action: ${action.type}`
          );

          break;
      }
    });
  };
}
