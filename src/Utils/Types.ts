export type TimeTrigger =
  | "second"
  | "minute"
  | "hour"
  | "day"
  | "week"
  | "month";

export interface ObjectType {
  _id: string;
  data;
  objectId: string;
}

export interface ModelType {
  key: string;
  name: string;
  name_plural: string;
  icon: string;
  app: string;
  primary: string;
  fields: { [name: string]: ModelFieldType };
  overviews: [ModelOverviewType];
  layouts: any;
  actions: any;
  api?: {
    read?: ModelApiType;
    create?: ModelApiType;
    modifyOwn?: ModelApiType;
    write?: ModelApiType;
    deleteOwn?: ModelApiType;
    delete?: ModelApiType;
  };
  permissions: {
    read: string[];
    create: string[];
    delete: string[];
    modifyOwn: string[];
    write: string[];
    deleteOwn: string[];
    archive: string[];
    archiveOwn: string[];
  };
  _id: any;
}
export interface ModelFieldType {
  name: string;
  required: boolean;
  unique: boolean;
  validations: [string];
  transformations: [string];
  type?: string;
  typeArgs?: {
    type?: string;
    relationshipTo?: string;
    options?: { label: string; value: string }[];
    formula?: string;
  };
}

export interface ModelOverviewType {
  fields: string[];
  buttons: string[];
  actions: string[];
}
interface ModelApiType {
  active: boolean;
  endpoint?: string;
  authentication?: "none" | "user";
}
export interface AutomationContextType {
  trigger: string;
  object?: ObjectType;
  model?: ModelType;
  change?;
  models;
  id;
}

export interface AutomationType {
  id: string;
  action: (context: AutomationContextType) => void;
  simpleActions: SimpleAction[];
}

export interface SimpleAction {
  type: "InsertObject" | "UpdateCurrentObject";
  arguments: {};
}
