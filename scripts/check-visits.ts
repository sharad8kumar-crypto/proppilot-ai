import {
  candidateSlots,
  formatSlot,
  pickOfferSlots,
  resolveVisitChoice,
} from "../src/lib/visits";

const now = Date.now();
const free = candidateSlots(now, 3, 2);
console.log("Free slots:", free.map((s) => formatSlot(s, now)));

console.log("\n-- No offer made yet --");
for (const text of [
  "Kal 11 baje visit karna hai",
  "parso shaam ko aa jaunga",
  "aaj 2 pm chalega",
  "kal 8 baje",
  "11 baje",
  "kal chalte hain",
]) {
  const r = resolveVisitChoice({ message: text, requestedTime: null, now, offered: [], free });
  console.log(JSON.stringify(text), "->", r.slot ? formatSlot(r.slot, now) : "no slot", r.specified ? "(asked for a time)" : "");
}

const offered = pickOfferSlots(free, 3);
console.log("\n-- After we offered --");
console.log("Offered:", offered.map((s) => formatSlot(s, now)));
for (const text of ["haan theek hai", "doosra wala", "option 3", "2 pm tomorrow?"]) {
  const r = resolveVisitChoice({ message: text, requestedTime: null, now, offered, free });
  console.log(JSON.stringify(text), "->", r.slot ? formatSlot(r.slot, now) : "no slot");
}