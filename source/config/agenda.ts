import { Agenda } from "agenda";

// One shared Agenda instance for the whole app — MongoDB-backed (same
// cluster as everything else, separate collection), so background jobs
// don't need a new piece of infrastructure (no Redis anywhere in this
// stack). Job definitions live next to what they do (see
// helper-function.ts's email jobs, archive.ts's archive job) and get
// registered onto this instance before startAgenda() is called.
const agenda = new Agenda({
  db: { address: process.env.DB_ADDRESS as string, collection: "agendaJobs" },
  processEvery: "30 seconds",
});

agenda.on("fail", (err: Error, job) => {
  console.error(`[agenda] job "${job.attrs.name}" failed:`, err.message);
});

const startAgenda = async (): Promise<void> => {
  await agenda.start();
  console.log("[agenda] started");
};

const stopAgenda = async (): Promise<void> => {
  await agenda.stop();
};

export { agenda, startAgenda, stopAgenda };
