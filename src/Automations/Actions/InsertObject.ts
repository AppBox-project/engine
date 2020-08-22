import { systemLog } from "../../Utils/General";

export const InsertObject = (context, args) =>
  new Promise((resolve, reject) => {
    systemLog(`InsertObject: ${args.type}`);
    context.models.entries.model
      .create({
        objectId: args.type,
        data: args.object,
      })
      .then(() => {
        resolve();
      });
  });
