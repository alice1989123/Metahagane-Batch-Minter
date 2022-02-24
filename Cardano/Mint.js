const { BlockFrost } = require("./BlockFrost/blockFrost");
const { prvKey, address, prvKey_2, address_2 } = require("./Keys/keys");
const wasm = require("./custom_modules/@emurgo/cardano-serialization-lib-nodejs/cardano_serialization_lib");
const {
  getProtocolParams,
  amountToValue,
  asciiToHex,
  getUtxos,
} = require("./Utils/Utils");
const CoinSelection = require("./CoinSelection");
const { add } = require("@blockfrost/blockfrost-js/lib/endpoints/ipfs");

/* console.log(path.join(__dirname, "/blockFrost"));
 */

//console.log(serverAddress);

module.exports = async function (
  assetsWithMetada,
  ttl,
  metadatalabel,
  addressOutput,
  extraLoveLaces
) {
  // AssetsWith metadata is a JSON With the assets to be minted as well as the metadata ttl is time to live, metadatadalabel 721..etc addressOutput is the address where the minted tokens will be sended, extraLovelace is the amount of extra LoveLaces to be added to the otuput so that is easily distributed tipically minAda per number of tokens + a pluss
  const protocolParameters = await getProtocolParams();

  const policy = await createLockingPolicyScript(ttl);

  const metadata = { [policy.id]: assetsWithMetada.metadatas };

  const assets = assetsWithMetada.assets;

  try {
    const tx = await mintTx(
      assets,
      metadata,
      policy,
      protocolParameters,
      metadatalabel,
      addressOutput,
      extraLoveLaces
    );
    const txHash = wasm.hash_transaction(tx.body());
    const witnesses = tx.witness_set();

    const vkeysWitnesses = wasm.Vkeywitnesses.new();
    const vkeyWitness = wasm.make_vkey_witness(txHash, prvKey);
    vkeysWitnesses.add(vkeyWitness);
    witnesses.set_vkeys(vkeysWitnesses);
    const transaction = wasm.Transaction.new(
      tx.body(),
      witnesses,
      tx.auxiliary_data() // transaction metadata
    );

    try {
      const CBORTx = Buffer.from(transaction.to_bytes(), "hex").toString("hex");
      //console.log(CBORTx);
      const submitionHash = await BlockFrost.txSubmit(CBORTx);
      console.log(`tx Submited tiwh txHas ${submitionHash}`);
      return submitionHash;
    } catch (e) {
      console.log(e);
      return e;
    }
  } catch (error) {
    console.log(error);
    return `${error}`;
  }
  // const metadata = METADATA
};

async function mintTx(
  assets, //
  metadata,
  policy,
  protocolParameters,
  metadatalabel,
  addressOutput,
  extraLoveLaces
) {
  const addressOutputShelley = wasm.Address.from_bech32(addressOutput);
  const addressShelley = wasm.Address.from_bech32(address);
  const checkValue = amountToValue(
    assets.map((asset) => ({
      unit: policy.id + asciiToHex(asset.name),
      quantity: asset.quantity,
    }))
  );

  const minAda = wasm.min_ada_required(
    wasm.Value.from_bytes(checkValue.to_bytes()),
    wasm.BigNum.from_str(protocolParameters.minUtxo)
  );

  let value = wasm.Value.new(wasm.BigNum.from_str("0"));

  const _outputs = wasm.TransactionOutputs.new();
  _outputs.add(
    wasm.TransactionOutput.new(addressOutputShelley, wasm.Value.new(minAda))
  );

  _outputs.add(
    wasm.TransactionOutput.new(
      addressOutputShelley,
      wasm.Value.new(wasm.BigNum.from_str(`${extraLoveLaces}`))
    )
  );

  const utxos = await getUtxos(address);

  CoinSelection.setProtocolParameters(
    protocolParameters.minUtxo,
    protocolParameters.linearFee.minFeeA,
    protocolParameters.linearFee.minFeeB,
    protocolParameters.maxTxSize
  );
  //@ts-ignore

  const selection = await CoinSelection.randomImprove(utxos, _outputs, 20);

  const nativeScripts = wasm.NativeScripts.new();
  nativeScripts.add(policy.script);

  const mintedAssets = wasm.Assets.new();
  assets.forEach((asset) => {
    mintedAssets.insert(
      wasm.AssetName.new(Buffer.from(asset.name)),
      wasm.BigNum.from_str(asset.quantity)
    );
  });

  const mintedValue = wasm.Value.new(wasm.BigNum.from_str("0"));

  const multiAsset = wasm.MultiAsset.new();
  multiAsset.insert(
    wasm.ScriptHash.from_bytes(policy.script.hash().to_bytes()),
    mintedAssets
  );

  mintedValue.set_multiasset(multiAsset);
  //value = value.checked_add(mintedValue);

  const mint = wasm.Mint.new();

  const mintAssets = wasm.MintAssets.new();
  assets.forEach((asset) => {
    mintAssets.insert(
      wasm.AssetName.new(Buffer.from(asset.name)),
      wasm.Int.new(wasm.BigNum.from_str(asset.quantity))
    );
  });

  mint.insert(
    wasm.ScriptHash.from_bytes(
      policy.script.hash(wasm.ScriptHashNamespace.NativeScript).to_bytes()
    ),
    mintAssets
  );

  const inputs = wasm.TransactionInputs.new();
  selection.input.forEach((utxo) => {
    inputs.add(
      wasm.TransactionInput.new(
        utxo.input().transaction_id(),
        utxo.input().index()
      )
    );
    value = value.checked_add(utxo.output().amount());
    value = value.checked_sub(
      wasm.Value.new(wasm.BigNum.from_str(`${extraLoveLaces}`))
    );
    value = value.checked_sub(wasm.Value.new(minAda));
  });

  //value = value.checked_sub(wasm.Value.new(wasm.BigNum.from_str("40000000")));

  const rawOutputs = wasm.TransactionOutputs.new();
  rawOutputs.add(wasm.TransactionOutput.new(addressShelley, value));
  //rawOutputs.add(wasm.TransactionOutput.new(addressShelley, value));
  rawOutputs.add(
    wasm.TransactionOutput.new(
      addressOutputShelley,
      wasm.Value.new(wasm.BigNum.from_str(`${extraLoveLaces}`))
        .checked_add(mintedValue)
        .checked_add(wasm.Value.new(minAda))
    )
  );

  const fee = wasm.BigNum.from_str("0");

  const rawTxBody = wasm.TransactionBody.new(
    inputs,
    rawOutputs,
    fee,
    policy.ttl
  );
  rawTxBody.set_mint(mint);
  //console.log(metadata);

  let _metadata;
  if (metadata) {
    const generalMetadata = wasm.GeneralTransactionMetadata.new();
    console.log(JSON.stringify(metadata));
    generalMetadata.insert(
      wasm.BigNum.from_str(metadatalabel),

      wasm.encode_json_str_to_metadatum(JSON.stringify(metadata))
    );
    _metadata = wasm.AuxiliaryData.new();
    _metadata.set_metadata(generalMetadata);

    rawTxBody.set_auxiliary_data_hash(wasm.hash_auxiliary_data(_metadata));
  }
  const witnesses = wasm.TransactionWitnessSet.new();
  witnesses.set_native_scripts(nativeScripts);

  const dummyVkeyWitness =
    "8258208814c250f40bfc74d6c64f02fc75a54e68a9a8b3736e408d9820a6093d5e38b95840f04a036fa56b180af6537b2bba79cec75191dc47419e1fd8a4a892e7d84b7195348b3989c15f1e7b895c5ccee65a1931615b4bdb8bbbd01e6170db7a6831310c";
  const vkeys = wasm.Vkeywitnesses.new();

  vkeys.add(
    // @ts-ignore

    wasm.Vkeywitness.from_bytes(Buffer.from(dummyVkeyWitness, "hex"))
  );
  vkeys.add(
    // @ts-ignore

    wasm.Vkeywitness.from_bytes(Buffer.from(dummyVkeyWitness, "hex"))
  );

  witnesses.set_vkeys(vkeys);

  const rawTx = wasm.Transaction.new(rawTxBody, witnesses, _metadata);
  const linearFee = wasm.LinearFee.new(
    wasm.BigNum.from_str(protocolParameters.linearFee.minFeeA),
    wasm.BigNum.from_str(protocolParameters.linearFee.minFeeB)
  );
  let minFee = wasm.min_fee(rawTx, linearFee);

  value = value.checked_sub(wasm.Value.new(minFee));
  const outputs = wasm.TransactionOutputs.new();
  outputs.add(wasm.TransactionOutput.new(addressShelley, value));
  outputs.add(
    wasm.TransactionOutput.new(
      addressOutputShelley,
      wasm.Value.new(wasm.BigNum.from_str(`${extraLoveLaces}`))
        .checked_add(mintedValue)
        .checked_add(wasm.Value.new(minAda))
    )
  );

  const finalTxBody = wasm.TransactionBody.new(
    inputs,
    outputs,
    minFee,
    policy.ttl
  );
  finalTxBody.set_mint(rawTxBody.multiassets());
  finalTxBody.set_auxiliary_data_hash(rawTxBody.auxiliary_data_hash());

  const finalWitnesses = wasm.TransactionWitnessSet.new();
  finalWitnesses.set_native_scripts(nativeScripts);

  const transaction = wasm.Transaction.new(
    finalTxBody,
    finalWitnesses,
    rawTx.auxiliary_data()
  );

  const size = transaction.to_bytes().length;
  if (size > protocolParameters.maxTxSize) console.log("tx is too big");

  return transaction;
}

async function createLockingPolicyScript(ttl) {
  const addressShelley = wasm.Address.from_bech32(address);
  const paymentKeyHash = wasm.BaseAddress.from_address(addressShelley)
    .payment_cred()
    .to_keyhash();

  const nativeScripts = wasm.NativeScripts.new();
  const script = wasm.ScriptPubkey.new(paymentKeyHash);
  const nativeScript = wasm.NativeScript.new_script_pubkey(script);
  /*  const lockScript = wasm.NativeScript.new_timelock_expiry(
    wasm.TimelockExpiry.new(ttl)
  ); */
  //nativeScripts.add(lockScript);

  nativeScripts.add(nativeScript);
  const finalScript = wasm.NativeScript.new_script_all(
    wasm.ScriptAll.new(nativeScripts)
  );

  const policyId = Buffer.from(finalScript.hash(0).to_bytes(), "hex").toString(
    "hex"
  );

  return { id: policyId, script: finalScript, ttl: ttl };
}

async function burnRoyality(ttl) {
  const policy = await createLockingPolicyScript(ttl);
  const assets = [{ unit: policy.id, quantity: "1" }];

  const protocolParameters = await getProtocolParams();
  const addressBench32_1 = serverAddress;
  const address = wasm.Address.from_bech32(addressBench32_1);
  const checkValue = amountToValue(assets);

  const minAda = wasm.BigNum.from_str("3000000");

  let value = wasm.Value.new(wasm.BigNum.from_str("0"));

  const _outputs = wasm.TransactionOutputs.new();
  _outputs.add(
    wasm.TransactionOutput.new(
      address,
      wasm.Value.new(minAda).checked_add(checkValue)
    )
  );
  //@ts-ignore

  const utxos = await getUtxos(addressBench32_1);
  //@ts-ignore

  CoinSelection.setProtocolParameters(
    protocolParameters.minUtxo,
    protocolParameters.linearFee.minFeeA,
    protocolParameters.linearFee.minFeeB,
    protocolParameters.maxTxSize
  );
  //@ts-ignore

  const selection = await CoinSelection.randomImprove(utxos, _outputs, 20);

  const nativeScripts = wasm.NativeScripts.new();
  nativeScripts.add(policy.script);

  const burnedAssets = wasm.Assets.new();
  burnedAssets.insert(
    wasm.AssetName.new(Buffer.from("")),
    wasm.BigNum.from_str("1")
  );

  const burnedValue = wasm.Value.new(wasm.BigNum.from_str("0"));

  const multiAsset = wasm.MultiAsset.new();
  multiAsset.insert(
    wasm.ScriptHash.from_bytes(policy.script.hash().to_bytes()),
    burnedAssets
  );

  burnedValue.set_multiasset(multiAsset);
  value = value.checked_add(burnedValue);

  const burn = wasm.Mint.new();

  const mintAssets = wasm.MintAssets.new();

  mintAssets.insert(
    wasm.AssetName.new(Buffer.from("")),
    wasm.Int.new_negative(wasm.BigNum.from_str("1"))
  );

  burn.insert(
    wasm.ScriptHash.from_bytes(
      policy.script.hash(wasm.ScriptHashNamespace.NativeScript).to_bytes()
    ),
    mintAssets
  );

  const inputs = wasm.TransactionInputs.new(); // TODO: here we should use a coinSelection Algorithm but there is some issue!! FIX!
  selection.input.forEach((utxo) => {
    inputs.add(
      wasm.TransactionInput.new(
        utxo.input().transaction_id(),
        utxo.input().index()
      )
    );
    value = value.checked_add(utxo.output().amount());
  });

  value = value.checked_sub(checkValue);
  value = value.checked_sub(checkValue);

  const rawOutputs = wasm.TransactionOutputs.new();
  rawOutputs.add(wasm.TransactionOutput.new(address, value));
  const fee = wasm.BigNum.from_str("0");

  const rawTxBody = wasm.TransactionBody.new(
    inputs,
    rawOutputs,
    fee,
    policy.ttl
  );
  rawTxBody.set_mint(burn);

  const witnesses = wasm.TransactionWitnessSet.new();
  witnesses.set_native_scripts(nativeScripts);

  const dummyVkeyWitness =
    "8258208814c250f40bfc74d6c64f02fc75a54e68a9a8b3736e408d9820a6093d5e38b95840f04a036fa56b180af6537b2bba79cec75191dc47419e1fd8a4a892e7d84b7195348b3989c15f1e7b895c5ccee65a1931615b4bdb8bbbd01e6170db7a6831310c";
  const vkeys = wasm.Vkeywitnesses.new();

  vkeys.add(
    // @ts-ignore

    wasm.Vkeywitness.from_bytes(Buffer.from(dummyVkeyWitness, "hex"))
  );
  vkeys.add(
    // @ts-ignore

    wasm.Vkeywitness.from_bytes(Buffer.from(dummyVkeyWitness, "hex"))
  );
  witnesses.set_vkeys(vkeys);

  const rawTx = wasm.Transaction.new(rawTxBody, witnesses);
  const linearFee = wasm.LinearFee.new(
    wasm.BigNum.from_str(protocolParameters.linearFee.minFeeA),
    wasm.BigNum.from_str(protocolParameters.linearFee.minFeeB)
  );
  let minFee = wasm.min_fee(rawTx, linearFee);

  value = value.checked_sub(wasm.Value.new(minFee));
  const outputs = wasm.TransactionOutputs.new();
  outputs.add(wasm.TransactionOutput.new(address, value));

  const finalTxBody = wasm.TransactionBody.new(
    inputs,
    outputs,
    minFee,
    policy.ttl
  );
  finalTxBody.set_mint(rawTxBody.multiassets());

  const finalWitnesses = wasm.TransactionWitnessSet.new();
  finalWitnesses.set_native_scripts(nativeScripts);

  const transaction = wasm.Transaction.new(
    finalTxBody,
    finalWitnesses,
    rawTx.auxiliary_data()
  );

  const size = transaction.to_bytes().length;
  if (size > protocolParameters.maxTxSize) console.log("tx is too big");

  try {
    const txHash = wasm.hash_transaction(transaction.body());
    const witnesses = transaction.witness_set();

    const vkeysWitnesses = wasm.Vkeywitnesses.new();
    const vkeyWitness = wasm.make_vkey_witness(txHash, prvKey);
    vkeysWitnesses.add(vkeyWitness);
    witnesses.set_vkeys(vkeysWitnesses);
    const transaction_ = wasm.Transaction.new(
      transaction.body(),
      witnesses,
      transaction.auxiliary_data() // transaction metadata
    );

    try {
      const CBORTx = Buffer.from(transaction_.to_bytes(), "hex").toString(
        "hex"
      );
      const submitionHash = await BlockFrost.txSubmit(CBORTx);
      console.log(`tx Submited with txHas ${submitionHash}`);
      return submitionHash;
    } catch (e) {
      console.log(e);
    }
  } catch (error) {
    console.log(error);
    return { error: error.info || error.toString() };
  }
  // const metadata = METADATA
}
