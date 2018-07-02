# bch-stresstest
node.js app for stress testing the BCH network

## Disclaimer
Use at your own risk. This is currently not polished, requires a dedicated node, and has no safety features.

## Usage
* Clone this repo
```sh
git clone https://github.com/SpendBCH/bch-stresstest.git
cd bch-stresstest
```
* Configure your node and bitbox settings in stresstest.js (check comments at the top)
* Update bitbox-cli version in package.json if required
* Install bitbox-cli
```sh
npm install
```
* Start the app. stresstest.js or stresstest_fast.js for 20 tx simultaneous
```sh
node stresstest.js
```
* Write down your mnemonic and WIF
* Send BCH to the receiving address displayed

### Made with [#BITBOX](https://github.com/bigearth/bitbox-cli)

### Known issues
1. The mining fee for split tx calculation is off and did fail when testing 10k+ tx. Save your mnemonic to recover these funds.
1. Sending more than 0.1 BCH may hit the max tx size limit. Your funds should be safe if you kept the WIF and mnemonic to recover.
