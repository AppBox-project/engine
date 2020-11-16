import Server from "./Server";
import ObjectType from "appbox-types";

// Engine specific
export interface AutomationContext {
  server: Server;
  object: ObjectType;
  dbAction;
  change;
}

export interface FormulaContext {
  server: Server;
}
