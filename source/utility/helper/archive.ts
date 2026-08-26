import mongoose from "mongoose";
import { agenda } from "../../config/agenda";

interface ArchiveResult {
  archived: number;
}

/**
 * Moves every document in `sourceCollection` older than `cutoff` (by
 * `dateField`) into `archiveCollection`, then removes them from the source.
 * Generic over raw collection names (not a Mongoose Model) so it works
 * against any collection without needing a duplicate archive schema per
 * model — an archived document doesn't need validation, it just needs to
 * exist somewhere colder than the live collection.
 *
 * Safety: documents are only deleted from the source AFTER the insert into
 * the archive collection has succeeded. If the insert throws, nothing is
 * deleted and the error propagates — never a silent partial archive.
 */
const archiveOlderThan = async (
  sourceCollection: string,
  archiveCollection: string,
  dateField: string,
  cutoff: Date,
  extraFilter: Record<string, unknown> = {}
): Promise<ArchiveResult> => {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("archiveOlderThan: no active MongoDB connection");
  }

  const filter = { ...extraFilter, [dateField]: { $lt: cutoff } };
  const source = db.collection(sourceCollection);
  const archive = db.collection(archiveCollection);

  const docs = await source.find(filter).toArray();
  if (docs.length === 0) {
    return { archived: 0 };
  }

  await archive.insertMany(docs, { ordered: false });

  const ids = docs.map((d) => d._id);
  await source.deleteMany({ _id: { $in: ids } });

  return { archived: docs.length };
};

// Registered so the job exists and could be scheduled, but is deliberately
// NOT wired to run anywhere (no agenda.every(...) call for it) — nobody has
// decided actual per-collection retention policy yet (see the pending
// "User flow" question this mirrors: don't guess a business rule, build the
// framework and let it be turned on deliberately later).
//
// Example of how a future policy would enable this for one collection,
// once someone decides the actual retention window:
//
//   agenda.define("archive-old-records", async () => {
//     const cutoff = new Date();
//     cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 2);
//     await archiveOlderThan("journal_entry", "journal_entry_archive", "date", cutoff);
//   });
//   agenda.every("0 3 * * *", "archive-old-records"); // 3am daily, once enabled
//
// For now the job is a documented no-op — defined so it shows up in Agenda's
// job list and can be hand-run for testing, but never actually scheduled.
const registerArchiveJob = (): void => {
  agenda.define("archive-old-records", async () => {
    console.log("[agenda] archive-old-records ran, but no collection has an archiving policy configured yet — see archive.ts");
  });
};

export { archiveOlderThan, registerArchiveJob };
