import { systemLog } from "../../Utils/General";
import { map } from "lodash";
import Nunjucks from "../../Utils/Formulas/Nunjucks";

const nunjucks = new Nunjucks();

export const UpdateCurrentObject = (context, args) =>
  new Promise((resolve, reject) => {
    systemLog(
      `UpdateCurrentObject (${context.id}): Updating ${context.object._id}`
    );
    map(args.update, (value, key) => {
      context.object.data[key] = nunjucks.engine.renderString(
        value,
        context.object.data
      );
      context.object.markModified(`data.${key}`);
    });
    context.object.save().then(() => {
      resolve();
    });
  });
