import { ModelType, ObjectType } from "./Types";
import DatabaseModel from "./Classes/DatabaseModel";
import functions from "./Formulas/Functions";
import { find } from "lodash";

var uniqid = require("uniqid");

export default class Formula {
  model: ModelType;
  formula: string;
  originalFormula: string;
  dependencies: { model: string; field: string; foreign: boolean }[] = [];
  tags: { tag: string; identifier: string }[] = [];
  name: string;
  modelCache: { [modelKey: string]: ModelType } = {};
  models: DatabaseModel;
  functions: { fName; fArgs }[] = [];
  outputType: "text" | "number" | "boolean" | "picture" = "text";

  constructor(
    formula: string,
    fieldKey: string,
    model: ModelType,
    models: DatabaseModel
  ) {
    this.originalFormula = formula;
    this.formula = formula;
    this.model = model;
    this.name = `${model.key}---${fieldKey}`;
    this.modelCache[model.key] = model;
    this.models = models;
  }

  // Compiling a formula
  // --> This function turns a formula (this.formula) into dependencies and caches the models along the way.
  compile = () =>
    new Promise(async (resolve) => {
      // Extract {{ tags }}
      const reg = new RegExp(/{{\s*(?<var>.*?)\s*}}/gm);
      let result;
      while ((result = reg.exec(this.formula))) {
        const varName = uniqid();
        this.tags.push({ tag: result.groups.var, identifier: varName });
        this.formula = this.formula.replace(result[0], `$___${varName}___$`);
      }

      // Turn tags into dependencies
      //@ts-ignore
      await this.tags.reduce(async (prevTag, tag) => {
        const tagParts = tag.tag.split(/[-+*\/](?![^\(]*\))/gm);
        //@ts-ignore
        await tagParts.reduce(async (prevTagPart, tagPart) => {
          // The regexp splits on -, but not within parenthesis
          const part = tagPart.trim();

          if (part.match(/\w*\(.+\)/)) {
            // This part has a function call. We need to preprocess these functions to figure out what the dependencies are.
            const func = new RegExp(/(?<fName>\w*)\((?<fArgs>.*)\)/gm).exec(
              part
            );
            await this.preprocessFunction(func.groups.fName, func.groups.fArgs);
          } else if (part.match(/\./)) {
            // A dot part indicates a foreign relationship.
            const ps = part.split(".");
            let currentModel = this.model.key;
            //@ts-ignore
            await ps.reduce(async (prev, curr) => {
              //@ts-ignore
              const previousModel: ModelType = await prev;
              if (previousModel)
                this.modelCache[previousModel.key] = previousModel;
              let promise;

              if (curr.match("_r")) {
                //--> Foreign dependency (follows relationships)
                const fieldName = curr.replace("_r", "");
                if (currentModel === this.model.key) {
                  // First part of path
                  const relationshipTo = this.modelCache[currentModel].fields[
                    fieldName
                  ].typeArgs.relationshipTo;
                  if (!this.modelCache[relationshipTo])
                    promise = this.models.models.model.findOne({
                      key: relationshipTo,
                    });
                  currentModel = relationshipTo;
                  this.dependencies.push({
                    model: this.model.key,
                    field: fieldName,
                    foreign: false,
                  });
                } else {
                  // Not first, not last part of path
                  const relationshipTo = this.modelCache[currentModel].fields[
                    fieldName
                  ].typeArgs.relationshipTo;
                  if (!this.modelCache[relationshipTo])
                    promise = this.models.models.model.findOne({
                      key: relationshipTo,
                    });
                  this.dependencies.push({
                    model: currentModel,
                    field: fieldName,
                    foreign: true,
                  });
                  currentModel = relationshipTo;
                }
              } else {
                // Last path of part
                // Not first, not last part of path
                this.dependencies.push({
                  model: currentModel,
                  field: curr,
                  foreign: true,
                });
              }

              return promise;
            }, ps[0]);
          } else {
            //--> Local dependency,
            this.dependencies.push({
              model: this.model.key,
              field: part,
              foreign: false,
            });
          }
        }, tagParts[0]);
      }, this.tags[0]);

      // Done
      console.log(`--> 🧪 Formula '${this.name}' compiled.`);
      resolve();
    });

  // Preprocess a function
  // -> Runs the func's preprocess call and returns it's dependencies
  // Also already parses the arguments
  preprocessFunction = (fName, fArgs) =>
    new Promise(async (resolve) => {
      // Step 1, process arguments
      // --> Split arguments based on comma
      const fArguments = fArgs.split(/,(?![^\(]*\))(?![^\[]*")(?![^\[]*")/gm); // Splits commas, except when they're in brackets or apostrophes
      const newArguments = [];
      // Loop through arguments (async) and if they are a function themselves, preprocess those first.
      await fArguments.reduce(async (prev, curr) => {
        if (curr.match(/\w*\(.+\)/)) {
          // This part has a function call. We need to preprocess these functions to figure out what the dependencies are.
          const func = new RegExp(/(?<fName>\w*)\((?<fArgs>.*)\)/gm).exec(curr);
          await this.preprocessFunction(func.groups.fName, func.groups.fArgs);
          // Todo: add compiled argument whereas possible
          newArguments.push(curr);
        } else {
          newArguments.push(curr.replace(/^['"]/g, "").replace(/['"]$/g, ""));
        }
        return true;
      }, fArguments[0]);

      // Done looping, now preprocess the function
      const deps = functions[fName].onCompile(newArguments);
      deps.map((dep) => {
        if (typeof dep === "string") {
          this.dependencies.push({
            model: this.model.key,
            field: dep.trim(),
            foreign: false,
          });
        } else {
          this.dependencies.push(dep);
        }
      });
      resolve();
    });

  // Use all the information available in this class after compilation and compile it
  calculate = async (dataObj: {}) =>
    new Promise(async (resolve) => {
      const data = { ...dataObj, TODAY: new Date() };
      const tags = this.formula.split(/\$___(?<tagName>.+?)___\$/gm);
      // Parse all tags

      let output: string | number | boolean = await tags.reduce(
        //@ts-ignore
        async (prev, t) => {
          const reducingFormula = (await prev) || this.formula;
          const tagId = t.trim();
          let parsedTag;

          if ((tagId.trim() || "").length > 0) {
            const tag = find(this.tags, (o) => o.identifier === tagId).tag;
            if (tag.match(/\w*\(.+\)/)) {
              const func = new RegExp(/(?<fName>\w*)\((?<fArgs>.*)\)/gm).exec(
                tag
              );
              parsedTag = await this.processFunction(
                func.groups.fName,
                func.groups.fArgs,
                data
              );
            } else {
              parsedTag = data[tag];
            }
          }

          if (parsedTag) {
            return reducingFormula.replace(`$___${tagId}___$`, parsedTag);
          } else {
            return reducingFormula;
          }
        },
        tags[0]
      );

      if (this.outputType === "number") output = parseInt(output);
      if (this.outputType === "boolean")
        output = output === "true" ? true : false;
      resolve(output);
    });

  processFunction = (fName, fArgs, data: {}) =>
    new Promise(async (resolve) => {
      const fArguments = fArgs.split(/,(?![^\(]*\))(?![^\[]*")(?![^\[]*")/gm); // Splits commas, except when they're in brackets or apostrophes
      const newArguments = await fArguments.reduce(async (prev, curr) => {
        const output = typeof prev === "string" ? [] : await prev;

        if (curr.match(/\w*\(.+\)/)) {
          // If one of the arguments contains a (sub) function, resolve that first, using this recurring function
          // Continue processing once all sub functions are resolved.
          const func = new RegExp(/(?<fName>\w*)\((?<fArgs>.*)\)/gm).exec(curr);
          output.push(
            await this.processFunction(
              func.groups.fName,
              func.groups.fArgs,
              data
            )
          );
        } else {
          output.push(curr);
        }
        return output;
      }, fArguments[0]);

      resolve(await functions[fName].execute(newArguments, data));
    });
}
