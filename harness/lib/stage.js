// Logs when a stage starts, and prefixes a thrown error with the stage's
// name before letting it propagate — Vitest halts at the first thrown
// error, so this is what makes it clear which stage failed and why.
export async function runStage(name, fn) {
  console.log(`\n[stage] -> ${name}`);
  try {
    return await fn();
  } catch (err) {
    err.message = `Stage "${name}" failed: ${err.message}`;
    throw err;
  }
}
