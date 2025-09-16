const app = require("../server");

// Vercel expects a function export, so wrap app:
module.exports = (req, res) => {
  app(req, res);
};
