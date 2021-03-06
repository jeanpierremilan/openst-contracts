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

/** @dev  This is the integration test with global constraint.
 *        Global constraint restricts sum of all the tokens to be transferred
 *        is not more than the set limit.
 *        In the test, we have set the limit as 200 tokens in LimitTransferGlobalConstraint
 *        contract.But,we try to transfer 250 tokens in a transaction.
 *
 *        Following steps are performed in the test :-
 *
 *        - EIP20TokenMock contract is deployed.
 *        - Organization contract is deployed and worker is set.
 *        - TokenRules contract is deployed.
 *        - TransferRule contract is deployed and it is registered in TokenRules.
 *        - TokenHolder contract is deployed by providing the wallets and
 *           required confirmations.
 *        - LimitTransferGlobalConstraint contract is deployed. It is registered
 *          in the TokenRules as global constraint. The limit per transaction is
 *          set to 200 tokens.
 *        - Verification of added global constraint is done.
 *        - Using EIP20TokenMock's setBalance method, tokens are provided to TH.
 *        - We generate executable data for TransferRule contract's transferFrom
 *           method.
 *        - Relayer calls executeRule method of tokenholder contract.
 *           After it's execution below verifications are done:
 *            - RuleExecuted event.
 *            - tokenholder balance.
 *            - 'to' address balance.
 */
const EthUtils = require('ethereumjs-util'),
  utils = require('../../test_lib/utils'),
  AccountsProvider = utils.AccountProvider,
  ExecuteRuleUtils = require('./utils'),
  BN = require('bn.js'),
  LimitTransferGlobalConstraint = artifacts.require('LimitTransferGlobalConstraint'),
  { Event } = require('../../test_lib/event_decoder');

contract('TokenHolder::executeRule', async (accounts) => {

  let accountProvider,
    tokenHolder,
    wallet1,
    eip20TokenMock,
    transferRule,
    tokenRules,
    ephemeralPrivateKey1,
    ephemeralKeyAddress1,
    keyData,
    totalBalance = 500,
    transferLimit = 200,
    limitTransferGlobalConstraint,
    worker;

  describe('ExecuteRule integration test', async () => {

    it('Verifies registration of global constraint in token rules', async () => {

      accountProvider = new AccountsProvider(accounts);

      // It is object destructuring.
      ( {
        tokenHolder,
        wallet1,
        eip20TokenMock,
        transferRule,
        tokenRules,
        worker,
      } = await ExecuteRuleUtils.setup(accountProvider));

      // We cannot transfer more than transferLimit i.e. 200 tokens in a
      // transaction.
      limitTransferGlobalConstraint = await LimitTransferGlobalConstraint.new(
        transferLimit,
      );

      await tokenRules.addGlobalConstraint(
        limitTransferGlobalConstraint.address,
        { from: worker },
      );

      assert.strictEqual(
        await tokenRules.globalConstraints(0),
        limitTransferGlobalConstraint.address,
      );

    });

    it('Should fail while transferring BTs more than global constraint on max tokens to be transferred', async () => {

      await eip20TokenMock.setBalance(tokenHolder.address, totalBalance);

      ephemeralPrivateKey1 = '0xa8225c01ceeaf01d7bc7c1b1b929037bd4050967c5730c0b854263121b8399f3';
      ephemeralKeyAddress1 = '0x62502C4DF73935D0D10054b0Fb8cC036534C6fb0';

      let currentBlockNumber = await web3.eth.getBlockNumber(),
        expirationHeight = currentBlockNumber + 50,
        spendingLimit = 300;

      await tokenHolder.submitAuthorizeSession(
        ephemeralKeyAddress1,
        spendingLimit,
        expirationHeight,
        { from: wallet1 },
      );

      keyData = await tokenHolder.ephemeralKeys(
        ephemeralKeyAddress1,
      );

      let currentNonce = keyData.nonce,
        amountTransferred = 250;

      let nextAvailableNonce = currentNonce.toNumber() + 1;
      const to = accountProvider.get();

      // Here, the total tokens that can be transferred is 200 for a transaction.
      // But, we are generating executable data to transfer 250 tokens.
      const transferFromExecutable = await ExecuteRuleUtils.generateTransferFromExecutable(
        tokenHolder.address,
        to,
        new BN(amountTransferred),
      );

      const { rsv } = await ExecuteRuleUtils.getExecuteRuleExTxData(
        tokenHolder.address,
        transferRule.address,
        transferFromExecutable,
        new BN(nextAvailableNonce),
        ephemeralPrivateKey1,
      );

      let transactionResponse = await tokenHolder.executeRule(
        transferRule.address,
        transferFromExecutable,
        (currentNonce.toNumber() + 1),
        rsv.v,
        EthUtils.bufferToHex(rsv.r),
        EthUtils.bufferToHex(rsv.s),
      );

      const events = Event.decodeTransactionResponse(
        transactionResponse,
      );

      utils.clearReceipts();
      await utils.logResponse(
        transactionResponse,
        "Execute rule with global constraint",
      );

      // We should check against false here, however current version of web3
      // returns null for false values in event log. After updating web3,
      // this test might fail and we should use false (as intended)
      assert.strictEqual(events[0].args['_status'], null);

      // 'to' address and tokenholder has 0 and 500 tokens even after executeRule
      // execution status is false as we tried to transfer more than the transfer
      // limit set in LimitTransferGlobalConstraint global constraint.
      assert.strictEqual(
        (await eip20TokenMock.balanceOf(to)).cmp(new BN(0)),
        0,
      );

      assert.strictEqual(
        (await eip20TokenMock.balanceOf(
          tokenHolder.address)).cmp(new BN(totalBalance)),
        0,
      );

    });

    it('Gas used for executeRule', async () => {

      utils.printGasStatistics();

    });

  });

});




