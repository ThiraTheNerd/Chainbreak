import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['chains/**/*.test.js'],
    testTimeout: 360_000,
    hookTimeout: 60_000,
    reporters: ['default', 'junit'],
    outputFile: { junit: './reports/junit.xml' },
    // Both chains provision real Docker resources against ONE shared
    // backend and ONE shared LocalStack instance — running chain files in
    // parallel worker processes would just make them fight over the same
    // Docker daemon for no speed benefit, and would interleave their
    // console output, which matters here because that output IS part of
    // the dissertation evidence trail.
    fileParallelism: false,
  },
});
