export const correctDataType = (val, type) => {
  let newVal = val;
  switch (type) {
    case "boolean":
      newVal = newVal === "true";
      break;
    case "number":
      newVal = parseInt(newVal);
      break;
    case "date":
      newVal = new Date(newVal); // Convert date stored as string
      break;
    default:
      break;
  }
  return newVal;
};
