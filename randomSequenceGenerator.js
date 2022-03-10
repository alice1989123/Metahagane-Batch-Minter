const shuffle = require("./Utils.js").shuffle;
const fs = require("fs");

const randomSequenceGenerator = function (n) {
  const array = Array.from(Array(n).keys());
  const suffledArray = shuffle(array);
  fs.writeFile(
    "./randomsequence.txt",
    JSON.stringify(suffledArray),
    { encoding: "utf-8" },
    () => console.log("random sequence writen successfully")
  );
};

module.exports = randomSequenceGenerator;
