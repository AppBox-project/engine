import Formula from "../../Utils/Formula";
import Task from "..";
const wkhtmltopdf = require("wkhtmltopdf");
const fs = require("fs");
const uniqid = require("uniqid");

export default (task: Task) =>
  new Promise(async (resolve) => {
    const model = await task.models.models.model.findOne({
      key: task.task.data.arguments.object.objectId,
    });
    const template = task.task.data.arguments.template;
    const object = task.task.data.arguments.object;

    console.log("Generating document:", task.task.data.name);

    // Create a formula (with the template) and compile it.
    const formula = new Formula(
      template.data.template,
      model,
      task.models,
      task.task._id
    );
    await formula.compile();
    const html = await formula.calculate(object.data, {
      server: task.server,
    });

    // Now that we have HTML, turn it into a PDF.
    const dir = `/AppBox/Files/Objects/${model.key}/${object._id}`;
    const filename = `${template.data["filename-prefix"]}-${uniqid()}.pdf`;
    fs.mkdirSync(dir, { recursive: true });

    await wkhtmltopdf(html, { pageSize: "letter", output: `${dir}/${filename}` });
    task.models.attachments.model.create({
      objectId: object._id,
      path: `${dir}/${filename}`,
      name: filename,
    });
  });
