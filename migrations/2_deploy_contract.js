var Lottery = artifacts.require('./Lottery.sol')

module.exports = function (deployer) {
  deployer.deploy(Lottery, '0xe09b281d82BB691b55d9F446a76675bf785D8d28', [
    20,
    10,
    5,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    2,
    2,
    2,
    2,
    2,
    2,
    2,
    2,
    2,
    2,
  ])
}
