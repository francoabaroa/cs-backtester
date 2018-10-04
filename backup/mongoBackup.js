var backup = require("mongodb-backup");
const CSConstants = require("../constants/CSConstants");
backup({
  uri: process.env.MONGO,
  root: "../../backup/",
  collections: ["pricealerts"]
});
