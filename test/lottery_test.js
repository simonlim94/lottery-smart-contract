const Lottery = artifacts.require('./Lottery')

contract('Lottery', function (accounts) {
  let contract
  let contractCreator = accounts[0]
  let beneficiaryAddress = accounts[1]
  const ONGOING_STATE = 0
  const ONE_ETH = 1000000000000000000

  beforeEach(async function () {
    let winningRatios = [20, 10, 5]
    for (let i = 0; i < 10; i++) {
      //special prize winning ratio
      winningRatios.push(3)
    }
    for (let i = 0; i < 10; i++) {
      //consolation prize winning ratio
      winningRatios.push(2)
    }

    contract = await Lottery.new(beneficiaryAddress, winningRatios, {
      from: contractCreator,
      gas: 2000000,
    })
  })

  it('contract is initialized', async function () {
    const actualBeneficiary = await contract.beneficiary.call()
    expect(actualBeneficiary).to.equal(beneficiaryAddress)

    const state = await contract.state.call()
    expect(state.valueOf().toNumber()).to.equal(ONGOING_STATE)
  })

  it('pay transaction into the pool', async function () {
    await contract.putFunding({ value: ONE_ETH, from: contractCreator })

    const totalFund = await contract.totalFund.call()
    expect(totalFund).to.eql(web3.utils.toBN(ONE_ETH))
  })

  it('failed to withdraw more than expected', async function () {
    await contract.putFunding({ value: ONE_ETH, from: contractCreator })

    const totalFund = await contract.totalFund.call()
    expect(totalFund).to.eql(web3.utils.toBN(ONE_ETH))

    try {
      await contract.setCompletedState()
      await contract.withdrawFromFunding(web3.utils.toBN(ONE_ETH + ONE_ETH))
      expect.fail()
    } catch (error) {
      expect(error.reason).to.equal('Insufficient fund to be withdrawed')
    }
  })

  it('successfully withdraw funding', async function () {
    await contract.putFunding({ value: ONE_ETH, from: contractCreator })

    const totalFund = await contract.totalFund.call()
    expect(totalFund).to.eql(web3.utils.toBN(ONE_ETH))

    await contract.setCompletedState()
    await contract.withdrawFromFunding(web3.utils.toBN(ONE_ETH))
  })

  it('buying invalid lottery ticket', async function () {
    try {
      await contract.buyLotteryTicket(10000, {
        value: 100,
        from: contractCreator,
      })
      expect.fail()
    } catch (error) {
      expect(error.reason).to.equal('Invalid lottery number is provided')
    }
  })

  it('buying valid lottery ticket', async function () {
    await contract.buyLotteryTicket(3808, { value: 100, from: contractCreator })

    const lotteryTickets = await contract.getLotteryTicketsForBettingNumber(
      3808,
    )
    expect(lotteryTickets[0].buyer).to.equal(contractCreator)
    expect(lotteryTickets[0].amount).to.equal('100')
  })

  it('distributing prize', async function () {
    await contract.putFunding({ value: ONE_ETH, from: contractCreator })
    await contract.setCompletedState()
    await contract.distributePrize(100, 100, beneficiaryAddress)
  })

  it('distributing prize with insufficient funding', async function () {
    try {
      await contract.putFunding({ value: ONE_ETH, from: contractCreator })
      await contract.setCompletedState()
      await contract.distributePrize(
        2,
        web3.utils.toBN(ONE_ETH),
        beneficiaryAddress,
      )
      expect.fail()
    } catch (error) {
      expect(error.reason).to.equal(
        'Sorry, system is having insufficient fund. Please contact admin',
      )
    }
  })

  it('finish result drawing before deadline', async function () {
    try {
      await contract.setDrawResultDeadline(Date.now() + 1000)

      let results = []
      while (results.length < 23) {
        let r = Math.floor(Math.random() * 9999) + 1
        if (results.indexOf(r) === -1) results.push(r)
      }
      await contract.finishResultDrawing(results)
      expect.fail()
    } catch (error) {
      expect(error.reason).to.equal(
        'Cannot finish result drawing before a deadline',
      )
    }
  })

  it('finish result drawing with passing invalid length of result', async function () {
    try {
      let results = []
      while (results.length < 20) {
        let r = Math.floor(Math.random() * 9999) + 0
        if (results.indexOf(r) === -1) results.push(r)
      }
      await contract.finishResultDrawing(results)
      expect.fail()
    } catch (error) {
      expect(error.reason).to.equal('Invalid length of drawing results array')
    }
  })

  it('finish result drawing with passing invalid result', async function () {
    try {
      let results = []
      while (results.length < 23) {
        let r = Math.floor(Math.random() * 9999) + 9999
        if (results.indexOf(r) === -1) results.push(r)
      }
      await contract.finishResultDrawing(results)
      expect.fail()
    } catch (error) {
      expect(error.reason).to.equal('Number must be between 0 and 9999')
    }
  })

  it('finish result drawing', async function () {
    let results = []
    while (results.length < 23) {
      let r = Math.floor(Math.random() * 9999) + 0
      if (results.indexOf(r) === -1) results.push(r)
    }
    await contract.finishResultDrawing(results)
  })

  it('buy winning lottery ticket', async function () {
    await contract.putFunding({ value: ONE_ETH, from: contractCreator })

    const bettingNumber = 9999
    let results = [bettingNumber] // assume buyer buy first prize ticket
    while (results.length < 23) {
      let r = Math.floor(Math.random() * 9999) + 0
      if (results.indexOf(r) === -1) results.push(r)
    }

    await contract.buyLotteryTicket(bettingNumber, {
      value: 100,
      from: beneficiaryAddress,
    })
    const initialBeneficiaryBalance = await web3.eth.getBalance(
      beneficiaryAddress,
    )

    await contract.finishResultDrawing(results)
    const afterBeneficiaryBalance = await web3.eth.getBalance(
      beneficiaryAddress,
    )
    expect(
      web3.utils
        .toBN(afterBeneficiaryBalance)
        .sub(web3.utils.toBN(initialBeneficiaryBalance))
        .toNumber(),
    ).to.equal(2000) // winning prize = buying price (100 wei) * first prizez ratio (20)
  })

  it('buy losing lottery ticket', async function () {
    await contract.putFunding({ value: ONE_ETH, from: contractCreator })

    const bettingNumber = 9999
    let results = []
    while (results.length < 23) {
      let r = Math.floor(Math.random() * 9999) + 0
      if (results.indexOf(r) === -1) results.push(r)
    }

    // if found 9999 inside random drawing then replace with something else
    let index = results.findIndex((result) => result === 9999)
    if (index > -1) {
      results[index] = 1000
    }

    await contract.buyLotteryTicket(bettingNumber, {
      value: 100,
      from: beneficiaryAddress,
    })
    const initialBeneficiaryBalance = await web3.eth.getBalance(
      beneficiaryAddress,
    )

    await contract.finishResultDrawing(results)
    const afterBeneficiaryBalance = await web3.eth.getBalance(
      beneficiaryAddress,
    )

    // remain unchanged due to not winning
    expect(web3.utils.toBN(initialBeneficiaryBalance)).to.eql(
      web3.utils.toBN(afterBeneficiaryBalance),
    )
  })

  it('event is emitted', async function () {
    callback = function (error, event) {
      expect(event.args.totalWinning.toNumber()).to.equal(10000)
    }
    contract.LotteryWinning(
      {
        fromBlock: 0,
      },
      callback,
    )

    try {
      await contract.putFunding({ value: ONE_ETH, from: contractCreator })
      await contract.setCompletedState()
      await contract.distributePrize(100, 100, beneficiaryAddress)
      await contract.reset()
    } catch (error) {
      console.error(error)
    }
  })
})
