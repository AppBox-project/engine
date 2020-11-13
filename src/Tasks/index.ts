import { error } from "console";
import Server from "../Utils/Server";
import DatabaseModel from "../Utils/Classes/DatabaseModel";
import { ObjectType } from "../Utils/Types";
import tasks from "./Tasks";

interface DatabaseTask extends ObjectType {
  data: {
    type: string;
    name: string;
    description: string;
    when: string;
    action: string;
    done: boolean;
    state: string;
    arguments: any;
    progress: number;
    target: "Supervisor" | "Engine";
  };
}

export default class Task {
  task: DatabaseTask;
  models: DatabaseModel;
  server: Server;

  constructor(task: DatabaseTask, models: DatabaseModel, server: Server) {
    this.task = task;
    this.models = models;
    this.server = server;
  }

  execute = () => {
    if (tasks[this.task.data.action]) {
      tasks[this.task.data.action](this);
    } else {
      error(`Task ${this.task.data.action} does not exist`);
    }
  };
}
