import { systemLog } from "../../Utils/General";
import { map } from "lodash";
import nunjucks from "../../Utils/Formulas/Nunjucks";

export const UpdateCurrentObject = (context, args) =>
  new Promise((resolve, reject) => {
    systemLog(
      `UpdateCurrentObject (${context.id}): Updating ${context.object._id}`
    );
    map(args.update, (value, key) => {
      context.object.data[key] = nunjucks.renderString(
        value,
        context.object.data
      );
      context.object.markModified(`data.${key}`);
    });
    context.object.save().then(() => {
      resolve();
    });
  });
