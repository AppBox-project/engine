import { systemLog } from "../../Utils/General";
import { map } from "lodash";
import nunjucks from "../../Utils/Formulas/Nunjucks";

export const InsertObject = (context, args) =>
  new Promise((resolve, reject) => {
    systemLog(`InsertObject: ${args.model}`);
    map(args.object, (value, key) => {
      args.object[key] = nunjucks.renderString(
        value,
        context.change.fullDocument
      );
    });
    context.models.entries.model
      .create({
        objectId: args.model,
        data: args.object,
      })
      .then(() => {
        resolve();
      });
  });
