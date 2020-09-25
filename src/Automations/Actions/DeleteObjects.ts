import { systemLog } from "../../Utils/General";

export const DeleteObjects = (context, args) =>
  new Promise((resolve, reject) => {
    systemLog(`DeleteObjects (${context.id}).`);
    context.models.objects.model
      .deleteMany({ ...(args.filter || {}), objectId: args.model })
      .then(() => {
        resolve();
      });
  });
