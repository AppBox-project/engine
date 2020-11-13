require("../Models/Models");
require("../Models/Objects");
require("../Models/Attachments");
var mongoose = require("mongoose");

export default class DatabaseModel {
  models: { model; stream; listeners: {} };
  objects: { model; stream; listeners: {} };
  attachments: { model; stream; listeners: {} };

  constructor(db) {
    this.models = {
      model: mongoose.model("Models"),
      stream: db.collection("models").watch(),
      listeners: {},
    };
    this.objects = {
      model: mongoose.model("Objects"),
      stream: db.collection("objects").watch(),
      listeners: {},
    };
    this.attachments = {
      model: mongoose.model("Attachments"),
      stream: db.collection("attachments").watch(),
      listeners: {},
    };
  }
}
