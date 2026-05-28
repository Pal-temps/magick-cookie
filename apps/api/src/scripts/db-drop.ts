import { existsSync, unlinkSync } from "fs";
import { config } from "../config";

function drop() {
  console.log("Dropping database...");
  if (existsSync(config.databasePath)) {
    unlinkSync(config.databasePath);
    console.log(`Database file deleted: ${config.databasePath}`);
  } else {
    console.log("No database file found, nothing to drop.");
  }
}

drop();
