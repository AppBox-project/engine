import { systemLog } from "../../Utils/General";

export const DeleteObjects = (context, args) =>
  new Promise((resolve, reject) => {
    systemLog(`DeleteObjects (${context.id}).`);
    context.models.entries.model
      .deleteMany({ ...(args.filter || {}), objectId: args.type })
      .then(() => {
        resolve();
      });
  });
