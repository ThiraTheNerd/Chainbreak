// harness/lib/stage.js
//
// Every chain is "do stage 1, then 2, then 3, then 4 — stop and say which
// one broke, and why, the moment any of them do." This tiny wrapper is the
// entire mechanism for that: it logs when a stage starts, and — if the
// stage throws — prefixes the error with the stage's name before letting
// it propagate. Vitest halts a test at the first thrown error, so every
// stage after the failing one is simply never attempted; that, plus the
// name prefix, is what "fails loudly at the first stage that fails,
// reporting which stage and why" means in practice here.
export async function runStage(name, fn) {
  console.log(`\n[stage] -> ${name}`);
  try {
    return await fn();
  } catch (err) {
    err.message = `Stage "${name}" failed: ${err.message}`;
    throw err;
  }
}
