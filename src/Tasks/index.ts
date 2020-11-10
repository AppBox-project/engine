import { error } from "console";
import tasks from "./Tasks";

interface DatabaseTask {
  data: {
    type: string;
    name: string;
    description: string;
    when: string;
    action: string;
    done: boolean;
    state: string;
    arguments: {};
    progress: number;
    target: "Supervisor" | "Engine";
  };
}

export default class Task {
  task: DatabaseTask;

  constructor(task: DatabaseTask) {
    this.task = task;
  }

  execute = () => {
    if (tasks[this.task.data.action]) {
      tasks[this.task.data.action](this);
    } else {
      error(`Task ${this.task.data.action} does not exist`);
    }
  };
}
