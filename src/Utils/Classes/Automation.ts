import { ModelType } from "../Types";
import DatabaseModel from "./DatabaseModel";
import Formula from "./Formula";

export default class Automation {
  name: string;
  formula?: Formula;
  model: ModelType;
  models: DatabaseModel;

  constructor(name: string, model: ModelType, models: DatabaseModel) {
    this.name = name;
    this.model = model;
    this.models = models;
  }

  // In case there's a formula in this automation; compile it.
  compileFormula = (formula: string, fieldKey: string) =>
    new Promise(async (resolve) => {
      this.formula = new Formula(formula, fieldKey, this.model, this.models);
      await this.formula.compile();
      resolve();
    });
}
