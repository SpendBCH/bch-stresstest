// Use below bitbox settings for broadcasting directly to a local node over RPC -- use bitbox-cli version 0.7.21 for this
let BITBOXCli = require('bitbox-cli/lib/bitboxcli').default

// Set connection details for a BCH node with RPC access
let BITBOX = new BITBOXCli({
  protocol: 'http',
  host: '127.0.0.1',
  port: 8332,
  username: 'your rpc username',
  password: 'your rpc password',
  corsproxy: false,
})

// Use below bitbox settings to connect to bitbox rest instance, modify source to rate limit to 1 request/3.5 seconds
// Use latest bitbox version with these settings
// let BITBOXCli = require('bitbox-cli/lib/bitbox-cli').default
// let BITBOX = new BITBOXCli()

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

let sendTxAsync = async (hex) => {
  return new Promise((resolve, reject) => {
    BITBOX.RawTransactions.sendRawTransaction(hex).then((result) => {
      console.log('txid:', result)
      if (result.length != 64) { // Very rough txid size check for failure
        reject("sendTxAsync failure: " + result)
      }
      else {
        resolve(result)
      }
    }, (err) => {
      reject(err)
    })
  })
}

let sendTxChainAsync = async (hexList) => {
  return new Promise(async (resolve, reject) => {
    let totalSent = 0
    for (let i = 0; i < hexList.length; i++) {
      try {
        await sendTxAsync(hexList[i])
        totalSent += 1
        await sleep(200)
      } catch (ex) {
        console.log("sendTxChainAsync, chain " + i + " ex:", ex)
        reject(ex)
        break
      }
    }

    resolve(totalSent)
  })
}


let getUtxos = async (address) => {
  return new Promise((resolve, reject) => {
    BITBOX.Address.utxo(address).then((result) => {
      console.log("utxo: ", result)
      resolve(result)
    }, (err) => {
      console.log(err)
      reject(err)
    })
  })
}

let pollForUtxo = async (address) => {
  // poll for utxo
  try {
    while (true) {
      // rate limit
      await sleep(10 * 1000)

      let utxos = await getUtxos(address)

      // return highest value utxo when first utxo is found
      if (utxos && utxos.length > 0)
        return utxos.sort((a, b) => { return a.satoshis - b.satoshis })[utxos.length - 1]
      else
        console.log("Waiting for funding...")
    }
  } catch (ex) {
    console.log("Poll for utxo ex: ", ex)
  }
}

let getTxDetails = async (txid) => {
  return new Promise((resolve, reject) => {
    BITBOX.Transaction.details(txid).then((result) => {
      //console.log("tx details", result)
      resolve(result)
    }, (err) => {
      reject(err)
    })
  })
}

let pollForConfirmation = async (txid) => {
  // poll for utxo
  while (true) {
    try {
      // rate limit
      await sleep(30 * 1000)

      let txDetails = await getTxDetails(txid)

      // return highest value utxo when first utxo is found
      if (txDetails && txDetails.confirmations > 0)
        return txDetails
      else
        console.log("Waiting for split tx confirmation...")
    } catch (ex) {
      console.log("Poll for confirmation ex: ", ex)
    }
  }
}

let main = async () => {
  let mnemonic = BITBOX.Mnemonic.generate(256)
  let rootSeed = BITBOX.Mnemonic.toSeed(mnemonic)
  let masterHDNode = BITBOX.HDNode.fromSeed(rootSeed, 'bitcoincash')
  let hdNode = BITBOX.HDNode.derivePath(masterHDNode, "m/44'/145'/0'")

  // derive the first external change address HDNode which is going to spend utxo
  let node0 = BITBOX.HDNode.derivePath(hdNode, "1/0")
  let node0CashAddress = BITBOX.HDNode.toCashAddress(node0)
  let node0LegacyAddress = BITBOX.HDNode.toLegacyAddress(node0)
  let node0WIF = BITBOX.ECPair.toWIF(BITBOX.HDNode.toKeyPair(node0))

  console.log("Write down your mnemonic in case of a problem where a manual recovery is required")
  console.log("For safety import mnemonic into Electron Cash and verify you have access to any funds you send")
  console.log("Your mnemonic: " + mnemonic)
  console.log("Your wif: " + node0WIF)
  console.log(`Send BCH to ${node0CashAddress} to start`)

  // Wait for utxo to arrive to build starting wallet
  let utxo = await pollForUtxo(node0LegacyAddress)

  // TODO: Get refund address from tx details
  let refundAddress = utxo.legacyAddress

  console.log("UTXO found. Change will be sent to:", refundAddress)

  let wallet = {
    satoshis: utxo.satoshis,
    txid: utxo.txid,
    vout: utxo.vout
  }

  let dustLimitSats = 546
  let maxTxChain = 24
  let feePerTx = BITBOX.BitcoinCash.getByteCount({ P2PKH: 1 }, { P2PKH: 1 })
  let satsPerAddress = feePerTx * maxTxChain + dustLimitSats
  let splitFeePerAddress = BITBOX.BitcoinCash.getByteCount({ P2PKH: 0 }, { P2PKH: 1 })
  let numAddresses = Math.floor((wallet.satoshis) / (satsPerAddress + feePerTx + splitFeePerAddress))

  // Check for max tx size limit
  let maxAddresses = 2900
  if (numAddresses > maxAddresses)
    numAddresses = maxAddresses

  // Reduce number of addresses if required for split tx fee
  let byteCount = 0
  let satsChange = 0
  while (satsChange < dustLimitSats) {
    // Calculate splitTx fee and change to return to refundAddress
    byteCount = BITBOX.BitcoinCash.getByteCount({ P2PKH: 1 }, { P2PKH: numAddresses + 1 })
    satsChange = wallet.satoshis - byteCount - (numAddresses * satsPerAddress)

    if (satsChange < dustLimitSats) {
      numAddresses = numAddresses - 1
    }
  }

  console.log(`Creating ${numAddresses} addresses to send ${numAddresses * maxTxChain} transactions with ${satsChange} sats change to be refunded`)

  let splitAddressResult = splitAddress(wallet, numAddresses, satsPerAddress, hdNode, node0, refundAddress, satsChange, maxTxChain)
  let splitTxHex = splitAddressResult.hex
  let walletChains = splitAddressResult.wallets

  // Broadcast split tx
  let splitTxid = await sendTxAsync(splitTxHex)
  console.log("Split txid: ", splitTxid)

  console.log("Creating batch transactions")
  // Generate transactions for each address
  let hexListByAddress = createChainedTransactions(walletChains, maxTxChain, refundAddress)

  // Wait for first confirmation before stress testing to avoid mempool chain limit
  console.log("Split tx completed. Waiting for first confirmation...")
  await pollForConfirmation(splitTxid)

  console.log("Split tx confirmed. Starting stress test in 10 seconds...")
  await sleep(10 * 1000)

  // Send up to 20 tx chains in parallel
  let parallelChains = []
  while (hexListByAddress.length) {
    parallelChains.push(hexListByAddress.splice(0, 20))
  }

  for (let i = 0; i < parallelChains.length; i++) {
    try {
      await Promise.all(parallelChains[i].map(async (hexList) => {
          try {
              await sendTxChainAsync(hexList)
          } catch (ex) {
              console.log(ex)
          }
      }))
    } catch (ex) {
      console.log(`Wallet chain_${i} exception:`, ex)
    }
  }

  console.log("Broadcast complete")
}

let txidFromHex = (hex) => {
  let buffer = Buffer.from(hex, "hex")
  let hash = BITBOX.Crypto.hash256(buffer).toString('hex')
  return hash.match(/[a-fA-F0-9]{2}/g).reverse().join('')
}

let splitAddress = (wallet, numAddresses, satsPerAddress, hdNode, node0, changeAddress, satsChange, maxTxChain) => {
  let transactionBuilder = new BITBOX.TransactionBuilder('bitcoincash');
  transactionBuilder.addInput(wallet.txid, wallet.vout);

  let walletChains = []
  for (let i = 0; i < numAddresses; i++) {
    let walletChain = []

    let firstNode = BITBOX.HDNode.derivePath(hdNode, `1/${i + 1}`)
    let firstNodeLegacyAddress = BITBOX.HDNode.toLegacyAddress(firstNode)

    walletChain.push({
      vout: i,
      address: firstNodeLegacyAddress,
      satoshis: satsPerAddress,
      keyPair: BITBOX.HDNode.toKeyPair(firstNode)
    })

    transactionBuilder.addOutput(firstNodeLegacyAddress, satsPerAddress)

    // Derive next maxTxChain-1 addresses and keypairs for this chain
    for (let j = 0; j < maxTxChain - 1; j++) {
      // let nextNode = BITBOX.HDNode.derivePath(hdNode, `0/${i * maxTxChain + j}`)
      // let nextNodeLegacyAddress = BITBOX.HDNode.toLegacyAddress(nextNode)
      // walletChain.push({
      //   keyPair: BITBOX.HDNode.toKeyPair(nextNode),
      //   address: nextNodeLegacyAddress
      // })
      walletChain.push({
        keyPair: BITBOX.HDNode.toKeyPair(firstNode),
        address: firstNodeLegacyAddress
      })
    }

    walletChains.push(walletChain)
  }

  // Check change against dust limit
  if (satsChange >= 546) {
    transactionBuilder.addOutput(changeAddress, satsChange)
  }

  let keyPair = BITBOX.HDNode.toKeyPair(node0);

  let redeemScript
  transactionBuilder.sign(0, keyPair, redeemScript, transactionBuilder.hashTypes.SIGHASH_ALL, wallet.satoshis)

  let hex = transactionBuilder.build().toHex()

  // txid of this split/fanout tx
  let splitTxid = txidFromHex(hex)

  let walletsWithTxid = walletChains.map((wc) => {
    wc[0].txid = splitTxid
    return wc
  })

  return {
    hex: hex,
    wallets: walletsWithTxid,
  }
}

let createChainedTransactions = (walletChains, numTxToChain, refundAddress) => {
  let hexByAddress = []

  for (let i = 0; i < walletChains.length; i++) {
    let walletChain = walletChains[i]

    let hexList = []
    let wallet = walletChain[0]
    for (let j = 0; j < numTxToChain; j++) {
      // Update keyPair to sign current tx
      wallet.keyPair = walletChain[j].keyPair

      // Send tx to next address until last tx, then send back to refundAddress
      let targetAddress
      if (j == numTxToChain - 1)
        targetAddress = refundAddress
      else
        targetAddress = walletChain[j + 1].address

      let txResult = createTx(wallet, targetAddress)

      // Update wallet for next send
      wallet.txid = txResult.txid
      wallet.satoshis = txResult.satoshis
      wallet.vout = txResult.vout

      hexList.push(txResult.hex)
    }
    hexByAddress.push(hexList.slice())
  }

  return hexByAddress
}

let createTx = (wallet, targetAddress) => {
  let transactionBuilder = new BITBOX.TransactionBuilder('bitcoincash')
  transactionBuilder.addInput(wallet.txid, wallet.vout)

  // Calculate fee @ 1 sat/byte
  let byteCount = BITBOX.BitcoinCash.getByteCount({ P2PKH: 1 }, { P2PKH: 1 })
  let satoshisAfterFee = wallet.satoshis - byteCount

  transactionBuilder.addOutput(targetAddress, satoshisAfterFee)

  let redeemScript
  transactionBuilder.sign(0, wallet.keyPair, redeemScript, transactionBuilder.hashTypes.SIGHASH_ALL, wallet.satoshis)

  let hex = transactionBuilder.build().toHex()

  let txid = txidFromHex(hex)

  return { txid: txid, satoshis: satoshisAfterFee, vout: 0, hex: hex }
}

// Launch app
main()