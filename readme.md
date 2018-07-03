# bch-stresstest
node.js app for stress testing the BCH network

## Disclaimer
Use at your own risk. This is currently not polished and has limited safety features.

## Normal Usage
* Clone this repo
```sh
git clone https://github.com/SpendBCH/bch-stresstest.git
cd bch-stresstest
```
* Install bitbox-cli
```sh
npm install
```
* Start the app
```sh
node stresstest.js
```
* Write down your mnemonic and WIF
* Send BCH to the receiving address displayed

## Usage with full local node
* Clone this repo
```sh
git clone https://github.com/SpendBCH/bch-stresstest.git
cd bch-stresstest
```
* Configure your node's RPC connection in stresstest.js 
* Set useRest to false in stresstest.js 
* (Optional) Increase or decrease the amount of tx to send concurrently with numParallelTx in stresstest.js 
* Set bitbox-cli version in package.json to 0.7.21
* Install bitbox-cli
```sh
npm install
```
* Start the app
```sh
node stresstest.js
```
* Write down your mnemonic and WIF
* Send BCH to the receiving address displayed

### Made with [#BITBOX](https://github.com/bigearth/bitbox-cli)

### Known issues
1. The mining fee for split tx calculation is off and can fail when testing 10k+ tx. Save your mnemonic to recover these funds.
1. Sending more than 0.1 BCH may hit the max tx size limit. Your funds should be safe if you kept the WIF and mnemonic to recover.
