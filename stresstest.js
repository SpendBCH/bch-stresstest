let StresstestShared = require('./stresstest-shared')

let main = async () => {
  // Generally set useRest to true. Only set to false if you are running on a local node
  let useRest = true

  // Settings for local node mode below:
  let numParallelTx = 20 // Number of parallel tx your node can handle
  let bitboxConfig = { // Your node's RPC creds
    protocol: 'http',
    host: '127.0.0.1',
    port: 8332,
    username: 'your rpc username',
    password: 'your rpc password',
    corsproxy: false,
  }

  let stShared = new StresstestShared(useRest, numParallelTx, bitboxConfig)
  await stShared.start()
}

main()