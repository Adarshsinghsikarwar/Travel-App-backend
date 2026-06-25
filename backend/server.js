import app from "./src/app.js";
import { port, nodeEnv } from "./src/config/env.js";
import connectDB from "./src/config/db.js";

connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running in ${nodeEnv} mode on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start server:", error);
  });
