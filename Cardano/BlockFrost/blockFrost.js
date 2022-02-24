const dotenv = require("dotenv").config();

const Blockfrost = require("@blockfrost/blockfrost-js");

const testNet = process.env.TESTNET;

const Blockfrost_KEY = testNet
  ? process.env.ID_TESTNET
  : process.env.ID_MAINNET;

const BlockFrost = new Blockfrost.BlockFrostAPI({
  projectId: Blockfrost_KEY,
});

module.exports.BlockFrost = BlockFrost;
