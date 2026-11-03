import assert from "node:assert/strict";
import { test } from "node:test";
import { cancelQueue, currentFile, nextInQueue, NO_QUEUE, queueOf, queuePosition } from "./crop-queue";

// A pick of several photos, cropped one at a time (issue #969): each file in
// turn, Skip moving past one, Cancel dropping the rest.

test("a pick crops each file in turn; skipping one moves to the next, and the queue ends after the last", () => {
  let queue = queueOf(["a", "b", "c"]);
  assert.deepEqual([currentFile(queue), queuePosition(queue)], ["a", { position: 1, count: 3 }]);
  queue = nextInQueue(queue); // a cropped
  queue = nextInQueue(queue); // b skipped
  assert.deepEqual([currentFile(queue), queuePosition(queue)], ["c", { position: 3, count: 3 }]);
  queue = nextInQueue(queue);
  assert.equal(currentFile(queue), null);
  assert.equal(currentFile(nextInQueue(queue)), null);
  assert.equal(currentFile(NO_QUEUE), null);
});

test("Cancel stops the rest of the pick", () => {
  assert.equal(currentFile(cancelQueue(nextInQueue(queueOf(["a", "b", "c"])))), null);
});
