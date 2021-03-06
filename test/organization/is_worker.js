// Copyright 2018 OpenST Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.


const Utils  = require('../test_lib/utils.js');

const Organization = artifacts.require('Organization');

contract('Organization::constructor', async (accounts) => {

  describe('Negative Tests', async () => {
    const accountProvider = new Utils.AccountProvider(accounts),
      owner = accountProvider.get(),
      worker = accountProvider.get();
    let organization = null;

    beforeEach(async function () {
      organization = await Organization.new({ from: owner });
    });

    it('Checks for non added worker, isWorker should return false.', async () => {
      assert.strictEqual(await organization.isWorker.call(worker), false);
    });

    it('Checks for expired worker, isWorker should return false.', async () => {
      let deltaExpirationHeight = 2;
      let expirationHeight = (await web3.eth.getBlockNumber())+deltaExpirationHeight;
      await organization.setWorker(worker, expirationHeight, { from: owner });
      // Dummy Transaction to increase block number
      for (let i = 0; i < deltaExpirationHeight; i += 1) {
        await Utils.advanceBlock();
      }
      assert.strictEqual(await organization.isWorker.call(worker), false);
    });

  });

  describe('SuccessFul Execution', async () => {

    const accountProvider = new Utils.AccountProvider(accounts),
      owner = accountProvider.get(),
      worker = accountProvider.get();
    let organization = null,
      expirationHeight = 0;

    beforeEach(async function () {
      organization = await Organization.new({ from: owner });
      expirationHeight = (await web3.eth.getBlockNumber())+10;
      await organization.setWorker(worker, expirationHeight, { from: owner });
    });

    it('Checks for added worker, isWorker returns true.', async () => {
      assert.strictEqual(await organization.isWorker.call(worker), true);
    });

  });

});
