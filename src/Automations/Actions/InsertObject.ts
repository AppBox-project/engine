import { systemLog } from "../../Utils/General";
import { map } from "lodash";
import Nunjucks from "../../Utils/Formulas/Nunjucks";

const nunjucks = new Nunjucks();

export const InsertObject = (context, args) =>
  new Promise((resolve, reject) => {
    systemLog(`InsertObject: ${args.model}`);
    map(args.object, (value, key) => {
      args.object[key] = nunjucks.engine.renderString(
        value,
        context.change.fullDocument
      );
    });
    context.models.objects.model
      .create({
        objectId: args.model,
        data: args.object,
      })
      .then(() => {
        resolve();
      });
  });
