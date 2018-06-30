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
* Start the app
```sh
node stresstest.js
```
* Write down your mnemonic and WIF
* Send BCH to the receiving address displayed

### Made with [#BITBOX](https://github.com/bigearth/bitbox-cli)
