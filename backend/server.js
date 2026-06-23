import app from "./src/app.js";
import config from "./src/config.js";
import connectDB from "./src/config/db.js";

connectDB()
  .then(() => {
    app.listen(config.port, () => {
      console.log(
        `Server running in ${config.nodeEnv} mode on port ${config.port}`
      );
    });
  })
  .catch((error) => {
    console.error("Failed to start server:", error);
  });
