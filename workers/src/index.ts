import { withStore } from "../../backend/src/repositories/file-store";

const command = process.argv[2] ?? "archive";

if (command === "archive") {
  const result = await withStore((store) => store.archiveDue(new Date()));
  console.log(JSON.stringify({ task: "archive", ...result }));
} else {
  console.error("Usage: npm run worker -- archive");
  process.exitCode = 1;
}
